# SydLiving AI - GCP Deployment Guide (Terraform IaC & Cloud Run)

This guide walks through deploying SydLiving AI to Google Cloud Platform using Terraform Infrastructure as Code (IaC), Cloud Run serverless containers, Google Secret Manager, and Google Artifact Registry.

---

## 1. Prerequisites

Before starting, ensure you have:
1. A **GCP Project** with billing enabled.
2. The **Google Cloud SDK (`gcloud`)** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```
3. **Terraform** (>= 1.5.0) or **OpenTofu** installed.
4. (Optional) **Docker** installed locally, or use Google Cloud Build.
5. API keys for external services:
   - **Google Gemini API Key** (`GEMINI_API_KEY`)
   - **Google Maps API Key** (`GOOGLE_MAPS_API_KEY`) with Distance Matrix & Places API enabled
   - (Optional) **Domain API Key** (`DOMAIN_API_KEY`)

---

## 2. Infrastructure Deployment with Terraform

### Step 1: Configure Terraform Variables
Navigate to the `terraform/` directory:
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
project_id           = "your-gcp-project-id"
region               = "australia-southeast1" # Sydney
app_name             = "sydliving"
db_path              = "/data/sydliving.db"

# API Keys
gemini_api_key       = "AIzaSy..."
google_maps_api_key  = "AIzaSy..."
domain_api_key       = "" # Optional
```

### Step 2: Initialize & Apply Terraform
```bash
# Initialize Terraform and download Google provider plugins
terraform init

# Review execution plan
terraform plan

# Provision GCP resources (Artifact Registry, Service Account, Secret Manager, Cloud Storage, Cloud Run)
terraform apply
```

Terraform will output:
- `backend_url`: URL of the Cloud Run FastAPI service
- `frontend_url`: URL of the Cloud Run React UI service
- `artifact_registry_repository`: URI for container image pushes
- `data_bucket_name`: Persistent Cloud Storage bucket name

---

## 3. Building & Deploying Container Images

Use the provided automation script from the repository root:
```bash
./scripts/build_and_deploy.sh YOUR_PROJECT_ID australia-southeast1
```

This script:
1. Validates Artifact Registry repository existence.
2. Builds the backend container image (using local Docker or Google Cloud Build).
3. Queries the deployed backend Cloud Run URL and injects it into the frontend build (`VITE_API_URL`).
4. Builds the frontend container image with Nginx SPA routing.
5. Pushes both images to Artifact Registry.
6. Deploys the images to the Cloud Run services.

---

## 4. Architecture & Key Features

### Serverless Compute (Cloud Run v2)
- **Scale to Zero:** Minimum instances set to `0` to keep idle costs minimal.
- **Fast Cold Starts:** Slim container images (`python:3.11-slim`, `nginx:alpine-slim`).
- **Second Generation Execution Environment:** Supports direct volume mounts and fast networking.

### Data Persistence
- SQLite database stored on Cloud Run volume mount `/data` backed by Google Cloud Storage (`google_storage_bucket.data_bucket`).
- Automated database seeding on first start (`entrypoint.sh` executes `seed.py` if the database file is absent).
- GCS versioning enabled for point-in-time recovery and automated backups.

### Security & Secrets Management
- All sensitive credentials (`GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `DOMAIN_API_KEY`) are stored in **Google Secret Manager**.
- Injected as environment variables directly into the Cloud Run container runtime via a dedicated least-privilege Service Account (`sydliving-runner`).
- No secrets hardcoded in source control or Docker images.

---

## 5. Verification & Testing

1. **Backend Health Check:**
   ```bash
   curl $(terraform -chdir=terraform output -raw backend_url)/api/health
   # Expected output: {"status":"ok"}
   ```

2. **Commute & Properties API Check:**
   ```bash
   curl "$(terraform -chdir=terraform output -raw backend_url)/api/hubs"
   curl "$(terraform -chdir=terraform output -raw backend_url)/api/properties?suburbs=Bondi,Manly"
   ```

3. **Frontend UI:**
   Open the `frontend_url` in your browser. Verify interactive map rendering, commute matrix overlays, and AI agent chat queries.

---

## 6. Teardown / Destroy

To decommission all resources and stop billing:
```bash
terraform -chdir=terraform destroy
```
