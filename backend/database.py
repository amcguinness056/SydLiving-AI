import sqlite3
from typing import Generator
import os

DB_PATH = os.environ.get("SQLITE_DB_PATH", os.path.join(os.path.dirname(__file__), "sydliving.db"))
db_dir = os.path.dirname(DB_PATH)
if db_dir and not os.path.exists(db_dir):
    os.makedirs(db_dir, exist_ok=True)

def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    """Dependency to get a SQLite database connection."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    # Return rows as dictionaries instead of tuples for easier JSON serialization
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
