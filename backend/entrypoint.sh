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

# Seed database if missing or outdated (< 200 properties)
NEED_SEED=false
if [ ! -f "${TARGET_DB}" ]; then
    NEED_SEED=true
else
    # Check if database has the full upgraded 252 property dataset
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
    if [ "${PROP_COUNT}" -lt 200 ]; then
        echo "[SydLiving Backend] Dataset is outdated (< 200 properties). Re-seeding upgraded dataset..."
        NEED_SEED=true
    fi
fi

if [ "${NEED_SEED}" = true ]; then
    echo "[SydLiving Backend] Seeding complete 252-property dataset..."
    python seed.py
    echo "[SydLiving Backend] Database seed completed successfully."
else
    echo "[SydLiving Backend] Database already has full dataset. Skipping seed."
fi

PORT="${PORT:-8080}"
echo "[SydLiving Backend] Starting FastAPI application on port ${PORT}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT}"
