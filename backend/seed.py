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
    cursor.execute('DROP TABLE IF EXISTS destination_hubs;')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS destination_hubs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        hub_type TEXT NOT NULL
    );
    ''')

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
        transfers INTEGER NOT NULL DEFAULT 0,
        estimated_opal_fare REAL NOT NULL DEFAULT 4.20,
        route_summary TEXT NOT NULL DEFAULT '',
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
    # Destination Hubs
    hubs = [
        {"id": "central", "name": "Central", "lat": -33.8825, "lon": 151.2066, "hub_type": "CBD Rail & Metro Hub"},
        {"id": "martin_place", "name": "Martin Place", "lat": -33.8679, "lon": 151.2114, "hub_type": "CBD Financial Hub"},
        {"id": "barangaroo", "name": "Barangaroo", "lat": -33.8617, "lon": 151.2014, "hub_type": "Waterfront Commercial Hub"},
        {"id": "victoria_cross", "name": "Victoria Cross (North Sydney)", "lat": -33.8378, "lon": 151.2072, "hub_type": "North Sydney Metro Hub"},
        {"id": "macquarie_park", "name": "Macquarie Park", "lat": -33.7766, "lon": 151.1213, "hub_type": "Tech & Innovation Hub"},
        {"id": "parramatta", "name": "Parramatta", "lat": -33.8175, "lon": 151.0034, "hub_type": "Western Sydney CBD Hub"}
    ]

    for hub in hubs:
        cursor.execute('''
        INSERT OR REPLACE INTO destination_hubs (id, name, latitude, longitude, hub_type)
        VALUES (?, ?, ?, ?, ?)
        ''', (hub["id"], hub["name"], hub["lat"], hub["lon"], hub["hub_type"]))

    # Sydney Suburbs and exact coords
    suburbs = {
        "Bondi Beach": {"lat": -33.891, "lon": 151.276, "beach_dist": 0.2},
        "Bondi Junction": {"lat": -33.892, "lon": 151.248, "beach_dist": 2.5},
        "Coogee": {"lat": -33.923, "lon": 151.253, "beach_dist": 0.4},
        "Randwick": {"lat": -33.916, "lon": 151.242, "beach_dist": 1.8},
        "Surry Hills": {"lat": -33.883, "lon": 151.214, "beach_dist": 4.5},
        "Paddington": {"lat": -33.884, "lon": 151.226, "beach_dist": 3.5},
        "Newtown": {"lat": -33.897, "lon": 151.178, "beach_dist": 7.2},
        "Marrickville": {"lat": -33.911, "lon": 151.156, "beach_dist": 8.5},
        "Waterloo": {"lat": -33.898, "lon": 151.207, "beach_dist": 5.5},
        "Balmain": {"lat": -33.858, "lon": 151.179, "beach_dist": 7.0},
        "Pyrmont": {"lat": -33.871, "lon": 151.194, "beach_dist": 6.0},
        "Crows Nest": {"lat": -33.826, "lon": 151.201, "beach_dist": 5.8},
        "Victoria Cross": {"lat": -33.838, "lon": 151.207, "beach_dist": 5.0},
        "Chatswood": {"lat": -33.798, "lon": 151.183, "beach_dist": 8.0},
        "Mosman": {"lat": -33.829, "lon": 151.244, "beach_dist": 1.2},
        "Manly": {"lat": -33.796, "lon": 151.282, "beach_dist": 0.2},
        "Macquarie Park": {"lat": -33.776, "lon": 151.121, "beach_dist": 14.0},
        "Parramatta": {"lat": -33.815, "lon": 151.001, "beach_dist": 25.0},
        "Cronulla": {"lat": -34.053, "lon": 151.152, "beach_dist": 0.3}
    }

    real_streets = {
        "Bondi Beach": ["Campbell Parade", "Curlewis Street", "Hall Street", "Glenayr Avenue", "Blair Street"],
        "Bondi Junction": ["Oxford Street", "Spring Street", "Grafton Street", "Ebley Street"],
        "Coogee": ["Arden Street", "Coogee Bay Road", "Dolphin Street", "Mount Street", "Bream Street"],
        "Randwick": ["Belmore Road", "Avoca Street", "High Street", "Alison Road"],
        "Surry Hills": ["Crown Street", "Bourke Street", "Riley Street", "Foveaux Street", "Albion Street"],
        "Paddington": ["Oxford Street", "Glenmore Road", "William Street", "Jersey Road"],
        "Newtown": ["King Street", "Enmore Road", "Alice Street", "Australia Street", "Wilson Street"],
        "Marrickville": ["Marrickville Road", "Illawarra Road", "Victoria Road", "Sydenham Road"],
        "Waterloo": ["Bourke Street", "George Street", "Elizabeth Street", "Raglan Street"],
        "Balmain": ["Darling Street", "Beattie Street", "Montague Street", "Mullens Street"],
        "Pyrmont": ["Harris Street", "Pyrmont Point Road", "Union Street", "Point Street"],
        "Crows Nest": ["Willoughby Road", "Alexander Street", "Burlington Street", "Falcon Street"],
        "Victoria Cross": ["Miller Street", "Pacific Highway", "Berry Street", "Mount Street"],
        "Chatswood": ["Victoria Avenue", "Albert Avenue", "Archer Street", "Pacific Highway", "Help Street"],
        "Mosman": ["Military Road", "Raglan Street", "Avenue Road", "Middle Head Road"],
        "Manly": ["The Corso", "Darley Road", "Sydney Road", "Pittwater Road", "Bower Street"],
        "Macquarie Park": ["Herring Road", "Talavera Road", "Waterloo Road", "Khartoum Road"],
        "Parramatta": ["Church Street", "Macquarie Street", "George Street", "Victoria Road", "O'Connell Street"],
        "Cronulla": ["Gerrale Street", "Cronulla Street", "Ewos Parade", "Surrey Street"]
    }

    adjectives = ["Spacious", "Sunny", "Modern Coastal", "Designer", "Charming", "Light-Filled", "Luxury", "Boutique", "Harborside", "Renovated"]
    types = ["Apartment", "Terrace Home", "Penthouse", "Sharehouse Suite", "Studio Loft", "Beachside Flat"]

    valid_photos = [
        "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&auto=format&fit=crop&q=80"
    ]

    properties = []
    for _ in range(75):
        suburb = random.choice(list(suburbs.keys()))
        data = suburbs[suburb]
        street_list = real_streets.get(suburb, ["Main Street", "High Street", "Ocean Street"])
        street = random.choice(street_list)
        
        prop_type = random.choice(types)
        bed = random.randint(1, 4)
        if prop_type == "Studio Loft":
            bed = 1
        bath = random.randint(1, max(1, bed - 1))
        
        suburb_rent_premium = 1.0
        if suburb in ["Bondi Beach", "Manly", "Mosman", "Paddington", "Surry Hills"]:
            suburb_rent_premium = 1.35
        elif suburb in ["Crows Nest", "Victoria Cross", "Balmain", "Pyrmont"]:
            suburb_rent_premium = 1.2
        elif suburb in ["Newtown", "Randwick", "Waterloo", "Chatswood"]:
            suburb_rent_premium = 1.05
        else:
            suburb_rent_premium = 0.85

        base_rent = (bed * 320) + (bath * 90) + 120
        weekly_rent = int(round((base_rent * suburb_rent_premium) / 10) * 10)
        
        adj = random.choice(adjectives)
        title = f"{adj} {bed}BR {prop_type} in {suburb}"
        address = f"{random.randint(1, 250)} {street}, {suburb}, NSW"
        
        description = f"This {adj.lower()} {bed} bedroom, {bath} bathroom {prop_type.lower()} in {suburb} offers an exceptional Sydney lifestyle. Situated on {street}, it features light-filled living spaces, premium finishes, and convenient transit links."
        photo_url = random.choice(valid_photos)
        
        lat_offset = random.uniform(-0.005, 0.005)
        lon_offset = random.uniform(-0.005, 0.005)
        
        available_days = random.randint(0, 25)
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
            max(0.1, round(data["beach_dist"] + random.uniform(-0.2, 0.3), 1)),
            available_date,
            description,
            photo_url
        ))

    cursor.executemany('''
    INSERT INTO properties (id, title, suburb, bedrooms, bathrooms, weekly_rent, address, latitude, longitude, distance_to_beach_km, available_date, description, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', properties)

    # Realistic Commute Matrix
    commutes = []
    hub_names = [h["name"] for h in hubs]

    for origin, origin_data in suburbs.items():
        for hub_name in hub_names:
            mode = "Train"
            duration = 25
            freq = 6
            transfers = 0
            fare = 4.20
            summary = f"Direct route to {hub_name}"

            if origin in ["Crows Nest", "Victoria Cross"] and hub_name in ["Barangaroo", "Martin Place", "Central"]:
                mode = "Sydney Metro M1"
                duration = 6 if hub_name == "Barangaroo" else (8 if hub_name == "Martin Place" else 11)
                freq = 4
                transfers = 0
                fare = 3.90
                summary = f"Direct Sydney Metro M1 to {hub_name}"
            elif origin == "Waterloo" and hub_name in ["Central", "Martin Place", "Barangaroo", "Victoria Cross (North Sydney)"]:
                mode = "Sydney Metro M1"
                duration = 4 if hub_name == "Central" else (7 if hub_name == "Martin Place" else (10 if hub_name == "Barangaroo" else 14))
                freq = 4
                transfers = 0
                fare = 3.90
                summary = f"Direct Sydney Metro M1 to {hub_name}"
            elif origin == "Chatswood" and hub_name in ["Barangaroo", "Martin Place", "Central", "Victoria Cross (North Sydney)"]:
                mode = "Sydney Metro M1"
                duration = 7 if hub_name == "Victoria Cross (North Sydney)" else (13 if hub_name == "Barangaroo" else 16)
                freq = 4
                transfers = 0
                fare = 4.40
                summary = "Sydney Metro M1 via Sydney Harbour Tunnel"
            elif origin == "Chatswood" and hub_name == "Macquarie Park":
                mode = "Sydney Metro M1"
                duration = 9
                freq = 4
                transfers = 0
                fare = 3.90
                summary = "Direct Sydney Metro M1 Northwest"
            elif origin == "Macquarie Park" and hub_name in ["Barangaroo", "Martin Place", "Central"]:
                mode = "Sydney Metro M1"
                duration = 21 if hub_name == "Barangaroo" else (24 if hub_name == "Martin Place" else 27)
                freq = 4
                transfers = 0
                fare = 5.20
                summary = "Direct Sydney Metro M1"
            elif origin in ["Surry Hills"] and hub_name in ["Central", "Martin Place", "Barangaroo"]:
                if hub_name == "Central":
                    mode = "Light Rail L2/L3"
                    duration = 5
                    freq = 5
                    transfers = 0
                    fare = 2.90
                    summary = "Direct Light Rail to Central"
                else:
                    mode = "Light Rail L2/L3"
                    duration = 12 if hub_name == "Martin Place" else 18
                    freq = 5
                    transfers = 0
                    fare = 3.80
                    summary = "Light Rail via George St"
            elif origin in ["Randwick"] and hub_name in ["Central", "Martin Place", "Barangaroo"]:
                mode = "Light Rail L2"
                duration = 18 if hub_name == "Central" else 26
                freq = 6
                transfers = 0
                fare = 4.20
                summary = "Direct Light Rail L2 via UNSW & Moore Park"
            elif origin == "Newtown" and hub_name in ["Central", "Martin Place", "Barangaroo"]:
                mode = "Sydney Trains T2/T3"
                duration = 7 if hub_name == "Central" else 16
                freq = 5
                transfers = 0
                fare = 3.80
                summary = "Direct train via Inner West Line"
            elif origin == "Marrickville" and hub_name in ["Central", "Martin Place"]:
                mode = "Sydney Trains T3"
                duration = 14 if hub_name == "Central" else 22
                freq = 8
                transfers = 0
                fare = 4.20
                summary = "Direct Bankstown Line train"
            elif origin in ["Bondi Beach", "Bondi Junction"]:
                if origin == "Bondi Junction":
                    mode = "Sydney Trains T4"
                    duration = 10 if hub_name == "Martin Place" else (14 if hub_name == "Central" else 22)
                    freq = 5
                    transfers = 0
                    fare = 3.90
                    summary = "Direct Eastern Suburbs T4 Line"
                else:
                    mode = "Express Bus 333"
                    duration = 28 if hub_name == "Martin Place" else 35
                    freq = 4
                    transfers = 0
                    fare = 4.20
                    summary = "Express 333 Bus via Bondi Rd"
            elif origin == "Coogee":
                mode = "Express Bus 374/373"
                duration = 28 if hub_name == "Central" else 36
                freq = 6
                transfers = 0
                fare = 4.20
                summary = "Direct Eastern Suburbs Bus"
            elif origin == "Paddington":
                mode = "Bus 333/340"
                duration = 12 if hub_name == "Martin Place" else 18
                freq = 4
                transfers = 0
                fare = 3.60
                summary = "Bus via Oxford St"
            elif origin == "Manly":
                if hub_name in ["Barangaroo", "Martin Place", "Central"]:
                    mode = "Sydney Ferries F1"
                    duration = 22 if hub_name == "Barangaroo" else 30
                    freq = 15
                    transfers = 0 if hub_name in ["Barangaroo", "Circular Quay"] else 1
                    fare = 8.60
                    summary = "Fast Ferry / F1 Ferry across Sydney Harbour"
                else:
                    mode = "B-Line Bus B1"
                    duration = 45
                    freq = 8
                    transfers = 1
                    fare = 5.60
                    summary = "B-Line Express to Spit Junction + connecting bus"
            elif origin == "Mosman":
                mode = "Sydney Ferries F4 / Bus 100"
                duration = 18 if hub_name == "Barangaroo" else 22
                freq = 10
                transfers = 0
                fare = 4.80
                summary = "Mosman Bay Ferry / Direct Military Rd Bus"
            elif origin == "Balmain":
                mode = "Sydney Ferries F8 / Bus 442"
                duration = 12 if hub_name == "Barangaroo" else 18
                freq = 10
                transfers = 0
                fare = 4.20
                summary = "Balmain East Ferry to Barangaroo Wharf 5"
            elif origin == "Pyrmont":
                mode = "Light Rail L1 / Walking"
                duration = 10 if hub_name == "Barangaroo" else 15
                freq = 6
                transfers = 0
                fare = 2.90
                summary = "Pyrmont Bridge stroll / Light Rail L1 to Central"
            elif origin == "Parramatta":
                if hub_name == "Parramatta":
                    mode = "Walk / Free Shuttle"
                    duration = 5
                    freq = 3
                    transfers = 0
                    fare = 0.00
                    summary = "Within Parramatta CBD precinct"
                elif hub_name == "Central":
                    mode = "Sydney Trains T1 / T2"
                    duration = 26
                    freq = 4
                    transfers = 0
                    fare = 5.60
                    summary = "Express T1 Western Line"
                elif hub_name == "Macquarie Park":
                    mode = "Metrobus M54"
                    duration = 32
                    freq = 10
                    transfers = 0
                    fare = 4.80
                    summary = "Direct Metrobus M54"
                else:
                    mode = "Sydney Trains T1"
                    duration = 34
                    freq = 5
                    transfers = 1
                    fare = 5.80
                    summary = "T1 train to Central with cross-platform transfer"
            elif origin == "Cronulla":
                if hub_name in ["Central", "Martin Place"]:
                    mode = "Sydney Trains T4"
                    duration = 52 if hub_name == "Central" else 58
                    freq = 12
                    transfers = 0
                    fare = 6.20
                    summary = "Direct Cronulla T4 Line train"
                else:
                    mode = "Sydney Trains T4"
                    duration = 65
                    freq = 12
                    transfers = 1
                    fare = 6.80
                    summary = "T4 train with City transfer"
            else:
                mode = "Sydney Trains"
                duration = random.randint(22, 48)
                freq = random.choice([5, 8, 10, 15])
                transfers = random.choice([0, 1])
                fare = 4.50
                summary = f"Transit connection to {hub_name}"

            commutes.append((origin, hub_name, mode, duration, freq, transfers, fare, summary))

    cursor.executemany('''
    INSERT OR REPLACE INTO commute_matrix (origin_suburb, destination_cbd_hub, transit_mode, duration_minutes, peak_frequency_mins, transfers, estimated_opal_fare, route_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', commutes)

def main():
    print(f"Connecting to database at {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Creating tables...")
    create_tables(cursor)
    
    print("Seeding upgraded Sydney dataset...")
    seed_data(cursor)
    
    conn.commit()
    conn.close()
    
    print("Seed complete! Created 6 destination hubs, 75 properties with photos, and commute route matrices.")

if __name__ == "__main__":
    main()
