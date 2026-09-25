#!/usr/bin/env bash
set -e

# Default DB path if not provided
TARGET_DB="${SQLITE_DB_PATH:-sydliving.db}"

echo "[SydLiving Backend] Checking database at: ${TARGET_DB}..."

TARGET_DIR=$(dirname "${TARGET_DB}")
if [ -n "${TARGET_DIR}" ] && [ ! -d "${TARGET_DIR}" ]; then
    echo "[SydLiving Backend] Creating directory ${TARGET_DIR}..."
    mkdir -p "${TARGET_DIR}"
fi

# Seed database if missing
if [ ! -f "${TARGET_DB}" ]; then
    echo "[SydLiving Backend] Database file not found. Seeding initial schema and Sydney data..."
    python seed.py
    echo "[SydLiving Backend] Database seed completed successfully."
else
    echo "[SydLiving Backend] Existing database detected. Skipping seed."
fi

PORT="${PORT:-8080}"
echo "[SydLiving Backend] Starting FastAPI application on port ${PORT}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT}"
