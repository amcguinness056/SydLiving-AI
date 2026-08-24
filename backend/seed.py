import sqlite3
import uuid
import random
from datetime import datetime, timedelta

DB_PATH = "sydliving.db"

def create_tables(cursor):
    cursor.execute('DROP TABLE IF EXISTS saved_properties;')
    cursor.execute('DROP TABLE IF EXISTS chat_messages;')
    cursor.execute('DROP TABLE IF EXISTS chat_sessions;')
    cursor.execute('DROP TABLE IF EXISTS users;')
    cursor.execute('DROP TABLE IF EXISTS properties;')
    cursor.execute('DROP TABLE IF EXISTS commute_matrix;')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        suburb TEXT NOT NULL,
        bedrooms INTEGER NOT NULL,
        bathrooms INTEGER NOT NULL,
        weekly_rent REAL NOT NULL,
        address TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        distance_to_beach_km REAL NOT NULL,
        available_date TEXT NOT NULL,
        description TEXT NOT NULL,
        photo_url TEXT NOT NULL
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS commute_matrix (
        origin_suburb TEXT NOT NULL,
        destination_cbd_hub TEXT NOT NULL,
        transit_mode TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        peak_frequency_mins INTEGER NOT NULL,
        PRIMARY KEY (origin_suburb, destination_cbd_hub)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT,
        avatar_url TEXT,
        auth_provider TEXT DEFAULT 'google'
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS saved_properties (
        user_id TEXT NOT NULL,
        property_id TEXT NOT NULL,
        PRIMARY KEY (user_id, property_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (property_id) REFERENCES properties(id)
    );
    ''')

def seed_data(cursor):
    # Sydney Suburbs and their approx coords
    suburbs = {
        "Coogee": {"lat": -33.923, "lon": 151.253, "beach_dist": 0.5},
        "Bondi": {"lat": -33.891, "lon": 151.276, "beach_dist": 0.3},
        "Newtown": {"lat": -33.897, "lon": 151.178, "beach_dist": 7.0},
        "Surry Hills": {"lat": -33.883, "lon": 151.214, "beach_dist": 4.0},
        "Manly": {"lat": -33.796, "lon": 151.282, "beach_dist": 0.2},
        "Parramatta": {"lat": -33.815, "lon": 151.001, "beach_dist": 25.0},
        "Chatswood": {"lat": -33.798, "lon": 151.183, "beach_dist": 10.0}
    }

    cbd_hubs = ["Barangaroo", "Martin Place", "Central", "Town Hall"]
    transit_modes = ["Train", "Bus", "Ferry", "Light Rail"]

    real_streets = {
        "Coogee": ["Arden Street", "Coogee Bay Road", "Dolphin Street", "Mount Street", "Bream Street"],
        "Bondi": ["Campbell Parade", "Curlewis Street", "Hall Street", "Glenayr Avenue", "Blair Street"],
        "Newtown": ["King Street", "Enmore Road", "Alice Street", "Australia Street", "Wilson Street"],
        "Surry Hills": ["Crown Street", "Bourke Street", "Riley Street", "Foveaux Street", "Albion Street"],
        "Manly": ["The Corso", "Darley Road", "Sydney Road", "Pittwater Road", "Bower Street"],
        "Parramatta": ["Church Street", "Macquarie Street", "George Street", "Victoria Road", "O'Connell Street"],
        "Chatswood": ["Victoria Avenue", "Albert Avenue", "Archer Street", "Pacific Highway", "Help Street"]
    }

    adjectives = {
        "Apartment": ["Sleek", "Modern", "Sun-drenched", "Executive", "Designer", "Oversized", "Boutique"],
        "Sharehouse": ["Sociable", "Relaxed", "Vibrant", "Creative", "Spacious", "Friendly", "Convenient"],
        "Studio": ["Chic", "Minimalist", "Cozy", "Urban", "Light-filled", "Renovated", "Compact"],
        "Terrace": ["Victorian", "Historic", "Restored", "Charming", "Classic", "Contemporary", "Elegant"],
        "House": ["Family-friendly", "Luxurious", "Architectural", "Private", "Entertainer's", "Grand", "Beautiful"]
    }
    
    types = ["Apartment", "Sharehouse", "Studio", "Terrace", "House"]
    properties = []
    
    for _ in range(50):
        suburb = random.choice(list(suburbs.keys()))
        data = suburbs[suburb]
        street = random.choice(real_streets[suburb])
        
        prop_type = random.choice(types)
        bed = random.randint(1, 5)
        if prop_type == "Studio":
            bed = 1
        elif prop_type == "Sharehouse":
            bed = random.randint(3, 6)
            
        bath = random.randint(1, max(1, bed - 1))
        if prop_type == "Studio":
            bath = 1
        
        # Base rent depends heavily on suburb and bedrooms
        suburb_multiplier = {"Bondi": 1.4, "Manly": 1.3, "Surry Hills": 1.25, "Coogee": 1.2, "Newtown": 1.1, "Chatswood": 1.0, "Parramatta": 0.75}
        
        base_rent = bed * 350 * suburb_multiplier[suburb]
        rent_modifier = random.uniform(0.9, 1.2)
        weekly_rent = round(base_rent * rent_modifier / 10) * 10
        
        adj = random.choice(adjectives[prop_type])
        title = f"{adj} {bed}BR {prop_type} in {suburb}"
        address = f"{random.randint(1, 350)} {street}, {suburb}, NSW"
        
        description = f"This {adj.lower()} {bed} bedroom, {bath} bathroom {prop_type.lower()} in {suburb} offers an exceptional Sydney lifestyle. Situated on {street}, it boasts modern amenities, spacious interiors, and is perfectly positioned for convenience and comfort."
        
        valid_photos = [
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1502672260266-1c1de2d96674?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop"
        ]
        photo_url = random.choice(valid_photos)
        
        lat_offset = random.uniform(-0.015, 0.015)
        
        # Prevent coastal properties from spawning in the ocean by pushing them inland (west)
        if suburb in ["Bondi", "Coogee"]:
            lon_offset = random.uniform(-0.02, 0)
        elif suburb == "Manly":
            lon_offset = random.uniform(-0.015, 0.005)
        else:
            lon_offset = random.uniform(-0.015, 0.015)
        
        available_days = random.randint(0, 30)
        available_date = (datetime.now() + timedelta(days=available_days)).strftime('%Y-%m-%d')
        
        properties.append((
            str(uuid.uuid4()),
            title,
            suburb,
            bed,
            bath,
            weekly_rent,
            address,
            data["lat"] + lat_offset,
            data["lon"] + lon_offset,
            data["beach_dist"] + random.uniform(-0.2, 0.5),
            available_date,
            description,
            photo_url
        ))

    cursor.executemany('''
    INSERT INTO properties (id, title, suburb, bedrooms, bathrooms, weekly_rent, address, latitude, longitude, distance_to_beach_km, available_date, description, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', properties)

    # Generate Commute Matrix
    commutes = []
    for origin in suburbs.keys():
        for dest in cbd_hubs:
            # Base logic for generating somewhat realistic times
            if origin in ["Coogee", "Bondi"] and dest in ["Barangaroo", "Martin Place"]:
                duration = random.randint(30, 45)
                mode = "Bus"
            elif origin in ["Newtown", "Surry Hills"]:
                duration = random.randint(10, 25)
                mode = "Train"
            elif origin == "Manly" and dest == "Barangaroo":
                duration = random.randint(25, 35)
                mode = "Ferry"
            elif origin in ["Parramatta", "Chatswood"]:
                duration = random.randint(25, 40)
                mode = "Train"
            else:
                duration = random.randint(15, 50)
                mode = random.choice(transit_modes)

            freq = random.choice([5, 10, 15, 20])
            commutes.append((origin, dest, mode, duration, freq))

    cursor.executemany('''
    INSERT OR REPLACE INTO commute_matrix (origin_suburb, destination_cbd_hub, transit_mode, duration_minutes, peak_frequency_mins)
    VALUES (?, ?, ?, ?, ?)
    ''', commutes)


def main():
    print(f"Connecting to database at {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Creating tables...")
    create_tables(cursor)
    
    print("Clearing existing data...")
    cursor.execute('DELETE FROM properties')
    cursor.execute('DELETE FROM commute_matrix')
    
    print("Seeding dummy data...")
    seed_data(cursor)
    
    conn.commit()
    conn.close()
    
    print("Seed complete! Created 50 properties and commute matrices.")

if __name__ == "__main__":
    main()
