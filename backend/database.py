import sqlite3
from typing import Generator
import os

DB_PATH = os.environ.get("SQLITE_DB_PATH", os.path.join(os.path.dirname(__file__), "sydliving.db"))
db_dir = os.path.dirname(DB_PATH)
if db_dir and not os.path.exists(db_dir):
    os.makedirs(db_dir, exist_ok=True)

def init_db_performance(conn: sqlite3.Connection):
    """Enable SQLite performance optimizations and ensure essential indexes."""
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
    except Exception:
        pass
    try:
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA cache_size=-10000;")
        conn.execute("PRAGMA temp_store=MEMORY;")
    except Exception:
        pass
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_properties_suburb ON properties(suburb);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_properties_rent_bed ON properties(weekly_rent, bedrooms);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_commute_dest ON commute_matrix(destination_cbd_hub, duration_minutes);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_saved_properties_user ON saved_properties(user_id);")
    except Exception:
        pass

def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    """Dependency to get a SQLite database connection with performance optimizations."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    init_db_performance(conn)
    # Return rows as dictionaries instead of tuples for easier JSON serialization
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
