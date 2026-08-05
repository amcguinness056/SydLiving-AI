import sqlite3
from typing import Generator
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "sydliving.db")

def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    """Dependency to get a SQLite database connection."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    # Return rows as dictionaries instead of tuples for easier JSON serialization
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
