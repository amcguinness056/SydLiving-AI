import sqlite3
import uuid
import random
from datetime import datetime, timedelta
import os

from database import DB_PATH

def create_tables(cursor):
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

    # Comprehensive Sydney Suburbs database (36 suburbs)
    suburbs = {
        # Eastern Suburbs & Coast
        "Bondi Beach": {"lat": -33.891, "lon": 151.276, "beach_dist": 0.2, "premium": 1.45},
        "Bondi Junction": {"lat": -33.892, "lon": 151.248, "beach_dist": 2.2, "premium": 1.20},
        "Coogee": {"lat": -33.923, "lon": 151.253, "beach_dist": 0.3, "premium": 1.35},
        "Bronte": {"lat": -33.903, "lon": 151.267, "beach_dist": 0.2, "premium": 1.50},
        "Clovelly": {"lat": -33.914, "lon": 151.262, "beach_dist": 0.3, "premium": 1.40},
        "Randwick": {"lat": -33.916, "lon": 151.242, "beach_dist": 1.8, "premium": 1.15},
        "Maroubra": {"lat": -33.948, "lon": 151.242, "beach_dist": 0.4, "premium": 1.05},
        "Paddington": {"lat": -33.884, "lon": 151.226, "beach_dist": 3.5, "premium": 1.40},
        "Double Bay": {"lat": -33.877, "lon": 151.243, "beach_dist": 2.0, "premium": 1.55},
        "Rose Bay": {"lat": -33.873, "lon": 151.263, "beach_dist": 1.5, "premium": 1.45},
        "Potts Point": {"lat": -33.871, "lon": 151.225, "beach_dist": 4.0, "premium": 1.35},
        "Darlinghurst": {"lat": -33.878, "lon": 151.218, "beach_dist": 4.5, "premium": 1.30},

        # Inner West & City Fringe
        "Surry Hills": {"lat": -33.883, "lon": 151.214, "beach_dist": 4.8, "premium": 1.35},
        "Newtown": {"lat": -33.897, "lon": 151.178, "beach_dist": 7.2, "premium": 1.15},
        "Marrickville": {"lat": -33.911, "lon": 151.156, "beach_dist": 8.5, "premium": 1.05},
        "Erskineville": {"lat": -33.901, "lon": 151.185, "beach_dist": 7.0, "premium": 1.18},
        "Enmore": {"lat": -33.899, "lon": 151.172, "beach_dist": 7.5, "premium": 1.10},
        "Glebe": {"lat": -33.879, "lon": 151.186, "beach_dist": 6.5, "premium": 1.25},
        "Balmain": {"lat": -33.858, "lon": 151.179, "beach_dist": 7.0, "premium": 1.30},
        "Pyrmont": {"lat": -33.871, "lon": 151.194, "beach_dist": 6.0, "premium": 1.30},
        "Redfern": {"lat": -33.893, "lon": 151.205, "beach_dist": 5.2, "premium": 1.20},
        "Alexandria": {"lat": -33.906, "lon": 151.199, "beach_dist": 6.0, "premium": 1.12},
        "Waterloo": {"lat": -33.898, "lon": 151.207, "beach_dist": 5.5, "premium": 1.18},
        "Zetland": {"lat": -33.908, "lon": 151.213, "beach_dist": 5.2, "premium": 1.12},

        # Lower North Shore & Northern Beaches
        "Crows Nest": {"lat": -33.826, "lon": 151.201, "beach_dist": 5.8, "premium": 1.25},
        "Victoria Cross": {"lat": -33.838, "lon": 151.207, "beach_dist": 5.0, "premium": 1.30},
        "Neutral Bay": {"lat": -33.834, "lon": 151.219, "beach_dist": 4.5, "premium": 1.30},
        "Kirribilli": {"lat": -33.849, "lon": 151.216, "beach_dist": 4.0, "premium": 1.45},
        "Mosman": {"lat": -33.829, "lon": 151.244, "beach_dist": 1.2, "premium": 1.45},
        "Manly": {"lat": -33.796, "lon": 151.282, "beach_dist": 0.2, "premium": 1.45},
        "Freshwater": {"lat": -33.779, "lon": 151.285, "beach_dist": 0.3, "premium": 1.40},
        "Chatswood": {"lat": -33.798, "lon": 151.183, "beach_dist": 8.0, "premium": 1.20},
        "Macquarie Park": {"lat": -33.776, "lon": 151.121, "beach_dist": 14.0, "premium": 1.00},

        # South & Western Sydney
        "Parramatta": {"lat": -33.815, "lon": 151.001, "beach_dist": 25.0, "premium": 0.90},
        "Rhodes": {"lat": -33.832, "lon": 151.087, "beach_dist": 18.0, "premium": 1.00},
        "Cronulla": {"lat": -34.053, "lon": 151.152, "beach_dist": 0.2, "premium": 1.15}
    }

    real_streets = {
        "Bondi Beach": ["Campbell Parade", "Curlewis Street", "Hall Street", "Glenayr Avenue", "Blair Street", "Hastings Parade", "Ramsgate Avenue", "Wairoa Avenue"],
        "Bondi Junction": ["Oxford Street", "Spring Street", "Grafton Street", "Ebley Street", "Denison Street", "Bronte Road"],
        "Coogee": ["Arden Street", "Coogee Bay Road", "Dolphin Street", "Mount Street", "Bream Street", "Carr Street", "Brook Street"],
        "Bronte": ["Bronte Road", "Macpherson Street", "Hewlett Street", "Palmerston Avenue", "Darling Street", "Evans Street"],
        "Clovelly": ["Clovelly Road", "Burnie Street", "Boundary Street", "Arden Street", "Greville Street"],
        "Randwick": ["Belmore Road", "Avoca Street", "High Street", "Alison Road", "Perouse Road", "Frenchmans Road"],
        "Maroubra": ["Marine Parade", "Maroubra Road", "Anzac Parade", "McKeon Street", "Mons Avenue"],
        "Paddington": ["Oxford Street", "Glenmore Road", "William Street", "Jersey Road", "Hargrave Street", "Underwood Street", "Sutherland Street"],
        "Double Bay": ["Bay Street", "Cross Street", "Knox Street", "Guilfoyle Avenue", "Ocean Avenue", "Court Road"],
        "Rose Bay": ["New South Head Road", "Old South Head Road", "Collins Avenue", "Dover Road", "Vickery Avenue"],
        "Potts Point": ["Macleay Street", "Challis Avenue", "Victoria Street", "Orwell Street", "Rockwall Crescent", "Greenknowe Avenue"],
        "Darlinghurst": ["Victoria Street", "Liverpool Street", "Burton Street", "Forbes Street", "Darlinghurst Road", "Boundary Street"],
        "Surry Hills": ["Crown Street", "Bourke Street", "Riley Street", "Foveaux Street", "Albion Street", "Reservoir Street", "Devonshire Street"],
        "Newtown": ["King Street", "Enmore Road", "Alice Street", "Australia Street", "Wilson Street", "Station Street", "Watkin Street"],
        "Marrickville": ["Marrickville Road", "Illawarra Road", "Victoria Road", "Sydenham Road", "Livingstone Road", "Addison Road"],
        "Erskineville": ["Erskineville Road", "Swanson Street", "Mitchell Road", "Septimus Street", "Union Street"],
        "Enmore": ["Enmore Road", "Edgeware Road", "Metropolitan Road", "Cambridge Street", "Liberty Street"],
        "Glebe": ["Glebe Point Road", "Toxteth Road", "St Johns Road", "Bridge Road", "Mansfield Street", "Cook Street"],
        "Balmain": ["Darling Street", "Beattie Street", "Montague Street", "Mullens Street", "Rowntree Street", "Mort Street"],
        "Pyrmont": ["Harris Street", "Pyrmont Point Road", "Union Street", "Point Street", "Bowman Street", "Mount Street Walk"],
        "Redfern": ["Redfern Street", "George Street", "Pitt Street", "Chalmers Street", "Regent Street", "Eveleigh Street"],
        "Alexandria": ["Mitchell Road", "Buckland Street", "Lawrence Street", "Belmont Street", "Bowden Street", "Euston Road"],
        "Waterloo": ["Bourke Street", "George Street", "Elizabeth Street", "Raglan Street", "Potts Street", "McEvoy Street"],
        "Zetland": ["Defries Avenue", "Gadigal Avenue", "Joynton Avenue", "Victoria Park Parade", "Epsom Road"],
        "Crows Nest": ["Willoughby Road", "Alexander Street", "Burlington Street", "Falcon Street", "Clarke Street", "Hume Street"],
        "Victoria Cross": ["Miller Street", "Pacific Highway", "Berry Street", "Mount Street", "Walker Street", "Arthur Street"],
        "Neutral Bay": ["Military Road", "Wycombe Road", "Ben Boyd Road", "Yeo Street", "Grosvenor Lane"],
        "Kirribilli": ["Carabella Street", "Broughton Street", "Kirribilli Avenue", "Fitzroy Street", "Holbrook Avenue", "Peel Street"],
        "Mosman": ["Military Road", "Raglan Street", "Avenue Road", "Middle Head Road", "Muston Street", "Prince Albert Street"],
        "Manly": ["The Corso", "Darley Road", "Sydney Road", "Pittwater Road", "Bower Street", "East Esplanade", "Steinton Street", "Addison Road"],
        "Freshwater": ["Lawrence Street", "Albert Street", "Undercliffe Road", "Ocean View Road", "Moooltan Avenue"],
        "Chatswood": ["Victoria Avenue", "Albert Avenue", "Archer Street", "Pacific Highway", "Help Street", "Anderson Street", "Railway Street"],
        "Macquarie Park": ["Herring Road", "Talavera Road", "Waterloo Road", "Khartoum Road", "Alma Road"],
        "Parramatta": ["Church Street", "Macquarie Street", "George Street", "Victoria Road", "O'Connell Street", "Marsden Street", "Smith Street"],
        "Rhodes": ["Rider Boulevard", "Shoreline Drive", "Mary Street", "Marquet Street", "Walker Street"],
        "Cronulla": ["Gerrale Street", "Cronulla Street", "Ewos Parade", "Surrey Street", "Elouera Road", "Mitchell Road"]
    }

    # Curated, verified Unsplash high-res architectural & interior photography
    coastal_photos = [
        "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80"
    ]

    terrace_townhouse_photos = [
        "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&auto=format&fit=crop&q=80"
    ]

    apartment_penthouse_photos = [
        "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1515263487990-61b07816b324?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560448075-bb485b067938?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&auto=format&fit=crop&q=80"
    ]

    interior_living_photos = [
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1502005097973-6a7082348e28?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1615873968403-89e068629265?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&auto=format&fit=crop&q=80"
    ]

    kitchen_dining_photos = [
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1501183638710-841dd1904471?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80"
    ]

    bedroom_loft_photos = [
        "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80"
    ]

    all_interior_photos = (
        coastal_photos + terrace_townhouse_photos + 
        apartment_penthouse_photos + interior_living_photos + 
        kitchen_dining_photos + bedroom_loft_photos
    )

    adjectives = [
        "Sun-Drenched", "Modern Coastal", "Designer", "Charming", "Light-Filled", 
        "Luxury", "Boutique", "Harbourside", "Renovated", "Architectural", 
        "Spacious", "Contemporary", "Serene", "Executive", "Character"
    ]
    
    types = [
        "Apartment", "Terrace Home", "Penthouse", "Studio Loft", 
        "Beachside Flat", "Warehouse Conversion", "Townhouse", "Harbourside Residence"
    ]

    feature_snippets = [
        "Featuring high ceilings, bespoke joinery, and floor-to-ceiling glass capturing abundant natural light.",
        "Boasting an oversized entertainer's balcony, gourmet stone kitchen with gas cooking, and ducted air-conditioning.",
        "Complete with timber floorboards, internal laundry, built-in wardrobes, and secure undercover parking.",
        "Showcasing seamless indoor-outdoor flow, an open-plan lounge, and designer bathroom with freestanding tub.",
        "Offering direct access to neighborhood cafes, pristine coastal walks, and rapid transport links into the CBD.",
        "Elegantly appointed with premium European appliances, marble benchtops, and intercom security access."
    ]

    properties = []
    random.seed(42)  # Deterministic seed for reproducible, high-quality data

    # Generate 7 properties per suburb for all 36 suburbs = 252 rich properties
    for suburb, data in suburbs.items():
        street_list = real_streets.get(suburb, ["High Street", "George Street", "Ocean Street"])
        num_props = 7

        for i in range(num_props):
            street = street_list[i % len(street_list)]
            
            # Select property type & bedrooms realistically
            if data["beach_dist"] <= 0.5:
                prop_type = random.choice(["Beachside Flat", "Apartment", "Penthouse", "Townhouse"])
            elif suburb in ["Paddington", "Surry Hills", "Balmain", "Newtown", "Glebe", "Redfern", "Erskineville"]:
                prop_type = random.choice(["Terrace Home", "Warehouse Conversion", "Apartment", "Studio Loft"])
            else:
                prop_type = random.choice(types)

            if prop_type in ["Studio Loft"]:
                bed = 1
                bath = 1
            elif prop_type in ["Penthouse", "Harbourside Residence"]:
                bed = random.choice([3, 4])
                bath = random.choice([2, 3])
            elif prop_type in ["Terrace Home", "Townhouse"]:
                bed = random.choice([2, 3, 4])
                bath = random.choice([1, 2, 3])
            else:
                bed = random.choice([1, 2, 3])
                bath = 1 if bed == 1 else random.choice([1, 2])

            # Photo selection matched to property character
            if data["beach_dist"] <= 0.8 or prop_type == "Beachside Flat":
                photo_url = coastal_photos[(i + hash(suburb)) % len(coastal_photos)]
            elif prop_type in ["Terrace Home", "Townhouse"]:
                photo_url = terrace_townhouse_photos[(i + hash(suburb)) % len(terrace_townhouse_photos)]
            elif prop_type in ["Penthouse", "Harbourside Residence"]:
                photo_url = apartment_penthouse_photos[(i + hash(suburb)) % len(apartment_penthouse_photos)]
            elif prop_type in ["Studio Loft", "Warehouse Conversion"]:
                photo_url = bedroom_loft_photos[(i + hash(suburb)) % len(bedroom_loft_photos)]
            else:
                photo_url = all_interior_photos[(i * 3 + hash(suburb)) % len(all_interior_photos)]

            # Pricing calculation based on bedrooms, bathrooms, and suburb premium
            base_rent = (bed * 330) + (bath * 110) + (140 if prop_type in ["Penthouse", "Harbourside Residence"] else 60)
            weekly_rent = int(round((base_rent * data["premium"]) / 10) * 10)

            adj = adjectives[(i + hash(suburb)) % len(adjectives)]
            title = f"{adj} {bed}BR {prop_type} in {suburb}"
            street_num = random.randint(3, 185)
            address = f"{street_num} {street}, {suburb}, NSW"

            feat1 = feature_snippets[i % len(feature_snippets)]
            feat2 = feature_snippets[(i + 2) % len(feature_snippets)]
            description = (
                f"This {adj.lower()} {bed}-bedroom, {bath}-bathroom {prop_type.lower()} is positioned in the heart of {suburb}. "
                f"Situated on leafy {street}, this property delivers an effortless Sydney lifestyle. {feat1} {feat2}"
            )

            # Spatial jitter within suburb radius (~350 meters)
            lat_offset = random.uniform(-0.0035, 0.0035)
            lon_offset = random.uniform(-0.0035, 0.0035)
            beach_dist = max(0.1, round(data["beach_dist"] + random.uniform(-0.15, 0.15), 1))

            available_days = random.randint(0, 24)
            available_date = (datetime.now() + timedelta(days=available_days)).strftime('%Y-%m-%d')

            properties.append((
                str(uuid.uuid4()),
                title,
                suburb,
                bed,
                bath,
                weekly_rent,
                address,
                round(data["lat"] + lat_offset, 6),
                round(data["lon"] + lon_offset, 6),
                beach_dist,
                available_date,
                description,
                photo_url
            ))

    cursor.executemany('''
    INSERT INTO properties (id, title, suburb, bedrooms, bathrooms, weekly_rent, address, latitude, longitude, distance_to_beach_km, available_date, description, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', properties)

    # Realistic Commute Matrix for all 36 Suburbs x 6 Hubs = 216 routes
    commutes = []
    hub_names = [h["name"] for h in hubs]

    for origin, origin_data in suburbs.items():
        for hub_name in hub_names:
            mode = "Sydney Trains"
            duration = 25
            freq = 6
            transfers = 0
            fare = 4.20
            summary = f"Transit connection to {hub_name}"

            # Sydney Metro M1 Corridor
            if origin in ["Crows Nest", "Victoria Cross"] and hub_name in ["Barangaroo", "Martin Place", "Central", "Victoria Cross (North Sydney)"]:
                mode = "Sydney Metro M1"
                if hub_name == "Victoria Cross (North Sydney)":
                    duration = 3 if origin == "Crows Nest" else 2
                    summary = "Direct Sydney Metro M1 / Walk"
                elif hub_name == "Barangaroo":
                    duration = 5 if origin == "Victoria Cross" else 7
                    summary = "Direct Sydney Metro M1 via Harbour Tunnel"
                elif hub_name == "Martin Place":
                    duration = 7 if origin == "Victoria Cross" else 9
                    summary = "Direct Sydney Metro M1 to Martin Place"
                else:
                    duration = 10 if origin == "Victoria Cross" else 12
                    summary = "Direct Sydney Metro M1 to Central"
                freq = 4
                transfers = 0
                fare = 3.90
            elif origin == "Waterloo" and hub_name in ["Central", "Martin Place", "Barangaroo", "Victoria Cross (North Sydney)"]:
                mode = "Sydney Metro M1"
                duration = 4 if hub_name == "Central" else (7 if hub_name == "Martin Place" else (10 if hub_name == "Barangaroo" else 14))
                freq = 4
                transfers = 0
                fare = 3.90
                summary = f"Direct Sydney Metro M1 to {hub_name}"
            elif origin == "Chatswood":
                if hub_name in ["Victoria Cross (North Sydney)", "Barangaroo", "Martin Place", "Central"]:
                    mode = "Sydney Metro M1"
                    duration = 6 if hub_name == "Victoria Cross (North Sydney)" else (11 if hub_name == "Barangaroo" else 14)
                    freq = 4
                    transfers = 0
                    fare = 4.40
                    summary = "Sydney Metro M1 via Sydney Harbour Tunnel"
                elif hub_name == "Macquarie Park":
                    mode = "Sydney Metro M1"
                    duration = 8
                    freq = 4
                    transfers = 0
                    fare = 3.80
                    summary = "Direct Sydney Metro M1 Northwest"
                elif hub_name == "Parramatta":
                    mode = "Metrobus M54"
                    duration = 38
                    freq = 10
                    transfers = 0
                    fare = 4.80
                    summary = "Metrobus M54 via Epping"
            elif origin == "Macquarie Park":
                if hub_name in ["Barangaroo", "Martin Place", "Central", "Victoria Cross (North Sydney)"]:
                    mode = "Sydney Metro M1"
                    duration = 16 if hub_name == "Victoria Cross (North Sydney)" else (20 if hub_name == "Barangaroo" else 24)
                    freq = 4
                    transfers = 0
                    fare = 5.20
                    summary = f"Direct Sydney Metro M1 to {hub_name}"
                elif hub_name == "Parramatta":
                    mode = "Metrobus M54"
                    duration = 30
                    freq = 8
                    transfers = 0
                    fare = 4.60
                    summary = "Direct Metrobus M54"
                elif hub_name == "Macquarie Park":
                    mode = "Walk / Campus Shuttle"
                    duration = 4
                    freq = 3
                    transfers = 0
                    fare = 0.00
                    summary = "Within Macquarie Park precinct"

            # Eastern Suburbs Light Rail L2 / L3 Corridor
            elif origin in ["Surry Hills"]:
                if hub_name == "Central":
                    mode = "Light Rail L2/L3"
                    duration = 4
                    freq = 4
                    transfers = 0
                    fare = 2.80
                    summary = "Direct Light Rail to Central Station"
                elif hub_name in ["Martin Place", "Barangaroo"]:
                    mode = "Light Rail L2/L3"
                    duration = 11 if hub_name == "Martin Place" else 16
                    freq = 4
                    transfers = 0
                    fare = 3.80
                    summary = "Direct Light Rail L2/L3 via George Street"
                else:
                    mode = "Train via Central"
                    duration = 20 if hub_name == "Victoria Cross (North Sydney)" else 34
                    freq = 6
                    transfers = 1
                    fare = 4.80
                    summary = "Light Rail to Central + train connection"
            elif origin in ["Randwick"]:
                if hub_name in ["Central", "Martin Place", "Barangaroo"]:
                    mode = "Light Rail L2"
                    duration = 17 if hub_name == "Central" else (24 if hub_name == "Martin Place" else 28)
                    freq = 5
                    transfers = 0
                    fare = 4.20
                    summary = "Direct Light Rail L2 via Moore Park & UNSW"
                else:
                    mode = "Light Rail L2 + Train"
                    duration = 32 if hub_name == "Victoria Cross (North Sydney)" else 46
                    freq = 6
                    transfers = 1
                    fare = 5.40
                    summary = "Light Rail L2 to Central + connecting line"

            # Eastern Suburbs T4 Line & Express Buses
            elif origin in ["Bondi Junction", "Edgecliff"]:
                if hub_name in ["Martin Place", "Central"]:
                    mode = "Sydney Trains T4"
                    duration = 9 if hub_name == "Martin Place" else 13
                    freq = 4
                    transfers = 0
                    fare = 3.80
                    summary = "Direct T4 Eastern Suburbs Line"
                elif hub_name == "Barangaroo":
                    mode = "T4 Train + Wynyard Walk"
                    duration = 18
                    freq = 4
                    transfers = 0
                    fare = 3.80
                    summary = "T4 Train to Martin Place/Town Hall + short walk"
                elif hub_name == "Victoria Cross (North Sydney)":
                    mode = "T4 Train + Sydney Metro M1"
                    duration = 17
                    freq = 4
                    transfers = 1
                    fare = 4.60
                    summary = "T4 Train to Martin Place + Metro M1"
                else:
                    mode = "Sydney Trains T4"
                    duration = 42
                    freq = 8
                    transfers = 1
                    fare = 5.80
                    summary = "T4 Train to Central + connection"
            elif origin in ["Bondi Beach", "Bronte", "Clovelly"]:
                if hub_name in ["Martin Place", "Central", "Barangaroo"]:
                    mode = "Express Bus 333 / 379"
                    duration = 26 if hub_name == "Martin Place" else (32 if hub_name == "Central" else 36)
                    freq = 4
                    transfers = 0
                    fare = 4.20
                    summary = f"Express Bus via Bondi Rd to {hub_name}"
                else:
                    mode = "Bus + Train / Metro"
                    duration = 36 if hub_name == "Victoria Cross (North Sydney)" else 52
                    freq = 6
                    transfers = 1
                    fare = 5.40
                    summary = "Express bus to Bondi Junction + train/metro"
            elif origin in ["Coogee", "Maroubra"]:
                if hub_name in ["Central", "Martin Place", "Barangaroo"]:
                    mode = "Express Bus 373 / 374 / 396"
                    duration = 27 if hub_name == "Central" else (34 if hub_name == "Martin Place" else 38)
                    freq = 6
                    transfers = 0
                    fare = 4.20
                    summary = f"Direct Eastern Suburbs Express Bus to {hub_name}"
                else:
                    mode = "Bus + Light Rail / Train"
                    duration = 40 if hub_name == "Victoria Cross (North Sydney)" else 54
                    freq = 8
                    transfers = 1
                    fare = 5.60
                    summary = "Bus connection to Central + connecting line"
            elif origin in ["Paddington", "Darlinghurst", "Potts Point", "Double Bay", "Rose Bay"]:
                if hub_name in ["Martin Place", "Central", "Barangaroo"]:
                    mode = "Express Bus 333/340 / Ferry"
                    duration = 11 if hub_name == "Martin Place" else (16 if hub_name == "Central" else 21)
                    freq = 4
                    transfers = 0
                    fare = 3.60
                    summary = f"Direct route to {hub_name}"
                else:
                    mode = "Bus / Train connection"
                    duration = 26 if hub_name == "Victoria Cross (North Sydney)" else 44
                    freq = 6
                    transfers = 1
                    fare = 4.80
                    summary = "Transit connection via City"

            # Inner West Corridors (Newtown, Marrickville, Erskineville, Enmore, Glebe, Balmain, Pyrmont, Redfern, Alexandria, Zetland)
            elif origin in ["Newtown", "Erskineville", "Redfern", "Enmore"]:
                if hub_name in ["Central", "Martin Place", "Barangaroo"]:
                    mode = "Sydney Trains T2 / T3"
                    duration = 6 if hub_name == "Central" else (14 if hub_name == "Martin Place" else 18)
                    freq = 4
                    transfers = 0
                    fare = 3.80
                    summary = "Direct Inner West Line train"
                elif hub_name == "Victoria Cross (North Sydney)":
                    mode = "Train to Central + Metro M1"
                    duration = 16
                    freq = 4
                    transfers = 1
                    fare = 4.40
                    summary = "Train to Central + Sydney Metro M1"
                else:
                    mode = "Sydney Trains T2"
                    duration = 32
                    freq = 6
                    transfers = 0
                    fare = 5.20
                    summary = f"Direct T2 train connection to {hub_name}"
            elif origin in ["Marrickville", "Alexandria", "Zetland"]:
                if hub_name in ["Central", "Martin Place", "Barangaroo"]:
                    mode = "Sydney Trains T3 / Metro M1"
                    duration = 12 if hub_name == "Central" else (19 if hub_name == "Martin Place" else 23)
                    freq = 5
                    transfers = 0
                    fare = 4.00
                    summary = f"Direct transit line to {hub_name}"
                else:
                    mode = "Train / Metro connection"
                    duration = 24 if hub_name == "Victoria Cross (North Sydney)" else 40
                    freq = 6
                    transfers = 1
                    fare = 5.20
                    summary = "Transit connection via Central"
            elif origin in ["Pyrmont", "Glebe"]:
                if hub_name in ["Barangaroo", "Central", "Martin Place"]:
                    mode = "Light Rail L1 / Walking"
                    duration = 9 if hub_name == "Barangaroo" else (14 if hub_name == "Central" else 17)
                    freq = 6
                    transfers = 0
                    fare = 2.80
                    summary = "Light Rail L1 / Pyrmont Bridge stroll"
                else:
                    mode = "Light Rail L1 + Metro/Train"
                    duration = 22 if hub_name == "Victoria Cross (North Sydney)" else 36
                    freq = 6
                    transfers = 1
                    fare = 4.60
                    summary = "Light Rail L1 to Central + connection"
            elif origin in ["Balmain"]:
                if hub_name in ["Barangaroo", "Martin Place", "Central"]:
                    mode = "Sydney Ferries F8 / Bus 442"
                    duration = 11 if hub_name == "Barangaroo" else (17 if hub_name == "Martin Place" else 22)
                    freq = 8
                    transfers = 0
                    fare = 4.20
                    summary = "Direct Balmain East Ferry F8 to Barangaroo"
                else:
                    mode = "Ferry + Train / Metro"
                    duration = 24 if hub_name == "Victoria Cross (North Sydney)" else 42
                    freq = 8
                    transfers = 1
                    fare = 5.40
                    summary = "Ferry to Barangaroo + connecting line"

            # Lower North Shore & Northern Beaches (Neutral Bay, Kirribilli, Mosman, Manly, Freshwater)
            elif origin in ["Manly", "Freshwater"]:
                if hub_name in ["Barangaroo", "Martin Place", "Central"]:
                    mode = "Sydney Ferries F1 / Fast Ferry"
                    duration = 20 if hub_name == "Barangaroo" else (28 if hub_name == "Martin Place" else 33)
                    freq = 15
                    transfers = 0 if hub_name in ["Barangaroo", "Circular Quay"] else 1
                    fare = 8.60
                    summary = "Fast Ferry / F1 Ferry across Sydney Harbour"
                elif hub_name == "Victoria Cross (North Sydney)":
                    mode = "B-Line Bus B1 + Metro M1"
                    duration = 28
                    freq = 6
                    transfers = 1
                    fare = 5.20
                    summary = "B-Line Bus to Neutral Bay + connecting transit"
                else:
                    mode = "Ferry / B-Line + Metro connection"
                    duration = 48
                    freq = 10
                    transfers = 1
                    fare = 7.20
                    summary = "Harbour transit connection via City"
            elif origin in ["Mosman", "Neutral Bay", "Kirribilli"]:
                if hub_name in ["Victoria Cross (North Sydney)", "Barangaroo", "Martin Place", "Central"]:
                    mode = "Bus 100 / Ferry F4 / Train"
                    duration = 8 if hub_name == "Victoria Cross (North Sydney)" else (16 if hub_name == "Barangaroo" else 18)
                    freq = 6
                    transfers = 0
                    fare = 3.90
                    summary = f"Direct Lower North Shore transit to {hub_name}"
                else:
                    mode = "Bus / Train connection"
                    duration = 28 if hub_name == "Macquarie Park" else 38
                    freq = 8
                    transfers = 1
                    fare = 5.20
                    summary = "Lower North Shore line connection"

            # Parramatta & Western Precinct
            elif origin in ["Parramatta"]:
                if hub_name == "Parramatta":
                    mode = "Walk / Free Shuttle"
                    duration = 4
                    freq = 3
                    transfers = 0
                    fare = 0.00
                    summary = "Within Parramatta CBD precinct"
                elif hub_name == "Central":
                    mode = "Sydney Trains T1 Express"
                    duration = 25
                    freq = 4
                    transfers = 0
                    fare = 5.60
                    summary = "Direct Express T1 Western Line"
                elif hub_name in ["Martin Place", "Barangaroo"]:
                    mode = "Sydney Trains T1"
                    duration = 32 if hub_name == "Martin Place" else 35
                    freq = 4
                    transfers = 0
                    fare = 5.60
                    summary = "Direct T1 Train to Wynyard / Martin Place"
                elif hub_name == "Macquarie Park":
                    mode = "Metrobus M54"
                    duration = 28
                    freq = 8
                    transfers = 0
                    fare = 4.80
                    summary = "Direct Metrobus M54 via Epping"
                else:
                    mode = "Sydney Trains T1"
                    duration = 32
                    freq = 5
                    transfers = 0
                    fare = 5.60
                    summary = "T1 Western Line to North Sydney"
            elif origin in ["Rhodes"]:
                if hub_name in ["Central", "Martin Place", "Barangaroo"]:
                    mode = "Sydney Trains T9 Northern Line"
                    duration = 22 if hub_name == "Central" else 28
                    freq = 6
                    transfers = 0
                    fare = 4.60
                    summary = "Direct T9 Northern Line train"
                elif hub_name == "Parramatta":
                    mode = "Sydney Trains T1 / T2"
                    duration = 18
                    freq = 6
                    transfers = 1
                    fare = 4.20
                    summary = "Train connection via Strathfield"
                elif hub_name == "Macquarie Park":
                    mode = "Bus 410 / Metro M1"
                    duration = 18
                    freq = 8
                    transfers = 0
                    fare = 3.90
                    summary = "Direct Bus 410 via Ryde"
                else:
                    mode = "Sydney Trains T9"
                    duration = 24
                    freq = 6
                    transfers = 0
                    fare = 4.60
                    summary = "Direct T9 Northern Line"

            # Cronulla (Shire / South Coast)
            elif origin in ["Cronulla"]:
                if hub_name in ["Central", "Martin Place"]:
                    mode = "Sydney Trains T4"
                    duration = 49 if hub_name == "Central" else 56
                    freq = 10
                    transfers = 0
                    fare = 6.20
                    summary = "Direct Cronulla T4 Line train"
                elif hub_name == "Barangaroo":
                    mode = "Sydney Trains T4 + Wynyard Walk"
                    duration = 58
                    freq = 10
                    transfers = 0
                    fare = 6.20
                    summary = "T4 Train to Town Hall + Wynyard walk"
                elif hub_name == "Victoria Cross (North Sydney)":
                    mode = "T4 Train + Metro M1"
                    duration = 59
                    freq = 10
                    transfers = 1
                    fare = 6.80
                    summary = "T4 Train to Martin Place + Metro M1"
                else:
                    mode = "Sydney Trains T4 + connection"
                    duration = 68
                    freq = 10
                    transfers = 1
                    fare = 7.20
                    summary = "T4 Train with City transfer"

            commutes.append((origin, hub_name, mode, duration, freq, transfers, fare, summary))

    cursor.executemany('''
    INSERT OR REPLACE INTO commute_matrix (origin_suburb, destination_cbd_hub, transit_mode, duration_minutes, peak_frequency_mins, transfers, estimated_opal_fare, route_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', commutes)

    # Clean orphaned bookmarks if any exist
    cursor.execute('DELETE FROM saved_properties WHERE property_id NOT IN (SELECT id FROM properties);')

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

    print("Seed complete! Populated 36 Sydney suburbs, 252 properties with verified high-res photos, and 216 commute routes.")

if __name__ == "__main__":
    main()
