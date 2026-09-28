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
        conn.execute("CREATE INDEX IF NOT EXISTS idx_properties_features ON properties(pet_friendly, parking_spaces, has_air_con);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_commute_dest ON commute_matrix(destination_cbd_hub, duration_minutes);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_saved_properties_user ON saved_properties(user_id);")
    except Exception:
        pass
    ensure_schema_migrations(conn)

def ensure_schema_migrations(conn: sqlite3.Connection):
    """Ensure newly introduced columns exist in properties and users tables."""
    try:
        # Properties migrations
        prop_cols = {row[1] for row in conn.execute("PRAGMA table_info(properties);").fetchall()}
        if prop_cols:
            if "parking_spaces" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN parking_spaces INTEGER DEFAULT 0;")
            if "pet_friendly" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN pet_friendly INTEGER DEFAULT 0;")
            if "has_air_con" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN has_air_con INTEGER DEFAULT 0;")
            if "inspection_time" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN inspection_time TEXT DEFAULT '';")
            if "is_real_listing" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN is_real_listing INTEGER DEFAULT 1;")
            if "external_url" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN external_url TEXT DEFAULT '';")
            if "image_urls" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN image_urls TEXT DEFAULT '[]';")
            if "features_list" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN features_list TEXT DEFAULT '[]';")
            if "agency_name" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN agency_name TEXT DEFAULT '';")
            if "agency_logo" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN agency_logo TEXT DEFAULT '';")
            if "agent_name" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN agent_name TEXT DEFAULT '';")
            if "agent_photo" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN agent_photo TEXT DEFAULT '';")
            if "agent_phone" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN agent_phone TEXT DEFAULT '';")
            if "property_type" not in prop_cols:
                conn.execute("ALTER TABLE properties ADD COLUMN property_type TEXT DEFAULT 'Apartment';")

        # Users migrations
        user_cols = {row[1] for row in conn.execute("PRAGMA table_info(users);").fetchall()}
        if user_cols:
            if "workplace_hub" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN workplace_hub TEXT DEFAULT 'Martin Place';")
            if "max_commute_mins" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN max_commute_mins INTEGER DEFAULT 45;")
            if "max_weekly_rent" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN max_weekly_rent REAL DEFAULT 1000.0;")
            if "min_bedrooms" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN min_bedrooms INTEGER DEFAULT 1;")
            if "has_pets" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN has_pets INTEGER DEFAULT 0;")
            if "needs_parking" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN needs_parking INTEGER DEFAULT 0;")
            if "lifestyle_vibes" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN lifestyle_vibes TEXT DEFAULT '[]';")
            if "preferred_transit_modes" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN preferred_transit_modes TEXT DEFAULT '[]';")
            if "kai_verbosity" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN kai_verbosity TEXT DEFAULT 'concise';")

        # Chat session titles migration
        try:
            from session_titler import migrate_legacy_session_titles
            migrate_legacy_session_titles(conn)
        except Exception:
            pass
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
