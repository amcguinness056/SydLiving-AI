#!/usr/bin/env bash
set -euo pipefail

# SydLiving AI - GCP Build and Deploy Helper
# Usage: ./scripts/build_and_deploy.sh [PROJECT_ID] [REGION]

PROJECT_ID="${1:-${GCP_PROJECT_ID:-}}"
REGION="${2:-${GCP_REGION:-australia-southeast1}}"
APP_NAME="${APP_NAME:-sydliving}"

if [ -z "${PROJECT_ID}" ]; then
    echo "Error: GCP Project ID is required."
    echo "Usage: $0 <PROJECT_ID> [REGION]"
    exit 1
fi

REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/${APP_NAME}-repo"
BACKEND_TAG="${REPO}/backend:latest"
FRONTEND_TAG="${REPO}/frontend:latest"

echo "=========================================================="
echo "SydLiving AI - GCP Container Build & Deployment"
echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo "Repo:     ${REPO}"
echo "=========================================================="

# Check for gcloud CLI
if ! command -v gcloud &> /dev/null; then
    echo "Error: 'gcloud' CLI is required. Please install Google Cloud SDK."
    exit 1
fi

# Ensure Artifact Registry repository exists
echo "[1/4] Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe "${APP_NAME}-repo" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" &> /dev/null || {
    echo "Creating repository ${APP_NAME}-repo in ${REGION}..."
    gcloud artifacts repositories create "${APP_NAME}-repo" \
        --project="${PROJECT_ID}" \
        --repository-format=docker \
        --location="${REGION}" \
        --description="Docker repository for ${APP_NAME}"
}

# Determine build method: local docker or Cloud Build
BUILD_METHOD="gcloud"
if command -v docker &> /dev/null && docker info &> /dev/null; then
    BUILD_METHOD="docker"
fi

echo "[2/4] Building Backend container image (Method: ${BUILD_METHOD})..."
if [ "${BUILD_METHOD}" = "docker" ]; then
    gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
    docker build -t "${BACKEND_TAG}" ./backend
    docker push "${BACKEND_TAG}"
else
    echo "Using Google Cloud Build for backend..."
    gcloud builds submit ./backend \
        --project="${PROJECT_ID}" \
        --tag="${BACKEND_TAG}"
fi

# Query or determine backend Cloud Run URL for frontend build arg
BACKEND_URL=$(gcloud run services describe "${APP_NAME}-backend" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --format='value(status.url)' 2>/dev/null || echo "")

if [ -z "${BACKEND_URL}" ]; then
    echo "Warning: Backend service not yet deployed. Frontend will default to relative /api paths."
    VITE_API_URL="/api"
else
    echo "Found backend URL: ${BACKEND_URL}"
    VITE_API_URL="${BACKEND_URL}"
fi

echo "[3/4] Building Frontend container image with VITE_API_URL=${VITE_API_URL}..."
if [ "${BUILD_METHOD}" = "docker" ]; then
    docker build \
        --build-arg VITE_API_URL="${VITE_API_URL}" \
        -t "${FRONTEND_TAG}" ./frontend
    docker push "${FRONTEND_TAG}"
else
    echo "Using Google Cloud Build for frontend..."
    gcloud builds submit ./frontend \
        --project="${PROJECT_ID}" \
        --substitutions=_VITE_API_URL="${VITE_API_URL}" \
        --tag="${FRONTEND_TAG}"
fi

echo "[4/4] Updating Cloud Run services with new container images..."
gcloud run deploy "${APP_NAME}-backend" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --image="${BACKEND_TAG}" \
    --quiet || echo "Backend service will be created on first 'terraform apply'."

gcloud run deploy "${APP_NAME}-frontend" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --image="${FRONTEND_TAG}" \
    --quiet || echo "Frontend service will be created on first 'terraform apply'."

echo "=========================================================="
echo "Deployment completed successfully!"
echo "Backend:  $(gcloud run services describe "${APP_NAME}-backend" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)' 2>/dev/null || echo 'Pending terraform apply')"
echo "Frontend: $(gcloud run services describe "${APP_NAME}-frontend" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)' 2>/dev/null || echo 'Pending terraform apply')"
echo "=========================================================="
