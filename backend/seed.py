import sqlite3
import uuid
import random
from datetime import datetime, timedelta

DB_PATH = "sydliving.db"

def create_tables(cursor):
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
        available_date TEXT NOT NULL
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

    # Generate Properties
    properties = []
    adjectives = ["Spacious", "Sunny", "Modern", "Cozy", "Luxury", "Quiet", "Charming"]
    types = ["Apartment", "Sharehouse", "Studio", "Terrace", "House"]
    
    for _ in range(50):
        suburb = random.choice(list(suburbs.keys()))
        data = suburbs[suburb]
        
        bed = random.randint(1, 5)
        bath = random.randint(1, max(1, bed - 1))
        
        # Base rent heavily depends on bedrooms and slightly on suburb
        base_rent = bed * 350
        rent_modifier = random.uniform(0.8, 1.5)
        weekly_rent = round(base_rent * rent_modifier / 10) * 10
        
        title = f"{random.choice(adjectives)} {bed}BR {random.choice(types)} in {suburb}"
        address = f"{random.randint(1, 200)} Fake Street, {suburb}, NSW"
        
        lat_offset = random.uniform(-0.005, 0.005)
        lon_offset = random.uniform(-0.005, 0.005)
        
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
            available_date
        ))

    cursor.executemany('''
    INSERT INTO properties (id, title, suburb, bedrooms, bathrooms, weekly_rent, address, latitude, longitude, distance_to_beach_km, available_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
