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
NEED_SEED=false
if [ ! -f "${TARGET_DB}" ]; then
    NEED_SEED=true
else
    # Check if database has listings
    PROP_COUNT=$(python -c "
import sqlite3
try:
    conn = sqlite3.connect('${TARGET_DB}')
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM properties')
    print(c.fetchone()[0])
    conn.close()
except Exception:
    print(0)
" 2>/dev/null || echo 0)
    echo "[SydLiving Backend] Detected ${PROP_COUNT} properties in ${TARGET_DB}."
    if [ "${PROP_COUNT}" -eq 0 ]; then
        echo "[SydLiving Backend] Database empty. Seeding foundational dataset..."
        NEED_SEED=true
    fi
fi

if [ "${NEED_SEED}" = true ]; then
    echo "[SydLiving Backend] Seeding foundational schema and data..."
    python seed.py
    echo "[SydLiving Backend] Database seed completed successfully."
fi

# If APIFY_API_TOKEN is present, automatically sync live real listings
if [ -n "${APIFY_API_TOKEN}" ]; then
    echo "[SydLiving Backend] APIFY_API_TOKEN detected. Syncing real live Sydney listings..."
    python -c "from sync_listings import sync_active_listings; res = sync_active_listings(only_real=True); print(res['message'])" || echo "[SydLiving Backend] Real listing sync encountered a non-fatal error."
fi

PORT="${PORT:-8080}"
echo "[SydLiving Backend] Starting FastAPI application on port ${PORT}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT}"
