#!/usr/bin/env python3
"""
CLI and automated cron entrypoint for syncing real Sydney active listings.
Usage:
    python scripts/sync_real_listings.py
"""
import os
import sys

# Ensure backend directory is in python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sync_listings import sync_active_listings

def main():
    print("Initiating active Sydney rental listings synchronization...")
    res = sync_active_listings(only_real=True)
    print(f"Status: {res['message']}")
    print(f"Source: {res['source']}")
    print(f"Total synced: {res['synced_count']}")

if __name__ == "__main__":
    main()
