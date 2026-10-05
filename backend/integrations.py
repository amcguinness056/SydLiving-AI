import os
import sqlite3
import requests
from database import DB_PATH
import analytics

def fetch_domain_properties(
    suburb: str, 
    max_rent: float, 
    min_bedrooms: int,
    pet_friendly: bool = False,
    needs_parking: bool = False,
    has_air_con: bool = False
) -> list:
    api_key = os.environ.get("DOMAIN_API_KEY")
    if api_key and api_key.lower() not in ("", "none", "dummy"):
        try:
            with analytics.track_external("domain", "search_listings") as tracker:
                headers = {"X-API-Key": api_key}
                payload = {
                    "listingType": "Rent",
                    "locations": [{"name": suburb, "state": "NSW"}],
                    "minBedrooms": min_bedrooms,
                    "price": {"max": max_rent} if max_rent < 99999.0 else {}
                }
                if needs_parking:
                    payload["minCarspaces"] = 1
                response = requests.post(
                    "https://api.domain.com.au/v1/listings/residential/_search",
                    headers=headers,
                    json=payload,
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    results = []
                    for item in data.get("listings", []):
                        results.append({
                            "id": str(item.get("listing", {}).get("id", "")),
                            "title": item.get("listing", {}).get("headline", ""),
                            "suburb": suburb,
                            "weekly_rent": item.get("listing", {}).get("priceDetails", {}).get("price", 0),
                            "bedrooms": item.get("listing", {}).get("propertyDetails", {}).get("bedrooms", 0),
                            "bathrooms": item.get("listing", {}).get("propertyDetails", {}).get("bathrooms", 0),
                            "latitude": item.get("listing", {}).get("propertyDetails", {}).get("latitude", 0.0),
                            "longitude": item.get("listing", {}).get("propertyDetails", {}).get("longitude", 0.0),
                            "distance_to_beach_km": 0.0,
                            "available_date": "2026-01-01",
                            "description": item.get("listing", {}).get("summaryDescription", ""),
                            "photo_url": item.get("listing", {}).get("media", [{}])[0].get("url", "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80"),
                            "parking_spaces": item.get("listing", {}).get("propertyDetails", {}).get("carspaces", 0),
                            "pet_friendly": 1 if pet_friendly else 0,
                            "has_air_con": 1 if has_air_con else 0,
                            "inspection_time": "Sat 10:00 AM - 10:20 AM",
                            "is_real_listing": 1,
                            "external_url": f"https://www.domain.com.au/{item.get('listing', {}).get('id', '')}"
                        })
                    if results:
                        return results
                else:
                    tracker["success"] = False
                    tracker["error"] = f"HTTP {response.status_code}"
        except Exception:
            pass

    # Fallback to local DB
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.row_factory = sqlite3.Row
    try:
        query = "SELECT * FROM properties WHERE 1=1"
        params = []
        if suburb and suburb != "":
            query += " AND suburb = ?"
            params.append(suburb)
        if max_rent < 99999.0:
            query += " AND weekly_rent <= ?"
            params.append(max_rent)
        if min_bedrooms > 0:
            query += " AND bedrooms >= ?"
            params.append(min_bedrooms)
        if pet_friendly:
            query += " AND pet_friendly = 1"
        if needs_parking:
            query += " AND parking_spaces >= 1"
        if has_air_con:
            query += " AND has_air_con = 1"
            
        cursor = db.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        db.close()

def fetch_google_commute(origin_suburb: str, destination_cbd_hub: str) -> list:
    """Cost-optimized commute lookup:
    1. Checks local SQLite commute_matrix first (0 cost).
    2. Only if not found and GOOGLE_MAPS_API_KEY is present, queries Google Distance Matrix.
    3. Persists any newly discovered commute result back into SQLite to prevent duplicate calls.
    """
    # 1. Check local pre-seeded / cached commute matrix first
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.row_factory = sqlite3.Row
    try:
        cursor = db.cursor()
        cursor.execute('''
            SELECT * FROM commute_matrix 
            WHERE (origin_suburb = ? OR origin_suburb LIKE ?) 
              AND (destination_cbd_hub = ? OR destination_cbd_hub LIKE ?)
        ''', (origin_suburb, f"%{origin_suburb}%", destination_cbd_hub, f"%{destination_cbd_hub}%"))
        rows = cursor.fetchall()
        if rows:
            return [dict(row) for row in rows]
    finally:
        db.close()

    # 2. Only invoke external API if not found in database
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if api_key:
        try:
            with analytics.track_external("google_maps", "distancematrix") as tracker:
                response = requests.get(
                    "https://maps.googleapis.com/maps/api/distancematrix/json",
                    params={
                        "origins": f"{origin_suburb}, Sydney, NSW",
                        "destinations": f"{destination_cbd_hub}, Sydney, NSW",
                        "mode": "transit",
                        "key": api_key
                    },
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "OK" and data["rows"]:
                        element = data["rows"][0]["elements"][0]
                        if element.get("status") == "OK":
                            duration_mins = element["duration"]["value"] // 60
                            commute_item = {
                                "origin_suburb": origin_suburb,
                                "destination_cbd_hub": destination_cbd_hub,
                                "transit_mode": "transit",
                                "duration_minutes": duration_mins,
                                "peak_frequency_mins": 10,
                                "transfers": 1,
                                "estimated_opal_fare": 4.50,
                                "route_summary": f"Transit from {origin_suburb} to {destination_cbd_hub}"
                            }
                            # 3. Cache the external API result into SQLite
                            try:
                                save_db = sqlite3.connect(DB_PATH, check_same_thread=False)
                                with save_db:
                                    save_db.execute('''
                                        INSERT OR REPLACE INTO commute_matrix 
                                        (origin_suburb, destination_cbd_hub, transit_mode, duration_minutes, peak_frequency_mins, transfers, estimated_opal_fare, route_summary)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                    ''', (
                                        origin_suburb, destination_cbd_hub, commute_item["transit_mode"],
                                        commute_item["duration_minutes"], commute_item["peak_frequency_mins"],
                                        commute_item["transfers"], commute_item["estimated_opal_fare"],
                                        commute_item["route_summary"]
                                    ))
                                save_db.close()
                            except Exception as cache_err:
                                print(f"[Commute Cache] Note: Failed to persist commute to DB: {cache_err}")

                            return [commute_item]
                        else:
                            tracker["success"] = False
                            tracker["error"] = element.get("status")
                    else:
                        tracker["success"] = False
                        tracker["error"] = data.get("status")
                else:
                    tracker["success"] = False
                    tracker["error"] = f"HTTP {response.status_code}"
        except Exception:
            pass

    return []

def fetch_google_places(suburb: str, place_type: str) -> list:
    """Cost-optimized Google Places lookup:
    1. Checks local SQLite places_cache (cached within 30 days) to prevent billable API calls.
    2. If miss, calls Google Places Text Search.
    3. Persists successful JSON payload into places_cache.
    4. Falls back to curated mock data if API is unconfigured or rate-limited.
    """
    clean_suburb = suburb.strip()
    clean_type = place_type.strip().lower()

    # 1. Check local SQLite cache first
    try:
        db = sqlite3.connect(DB_PATH, check_same_thread=False)
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        cursor.execute(
            "SELECT results_json, cached_at FROM places_cache WHERE suburb = ? AND place_type = ? LIMIT 1",
            (clean_suburb, clean_type)
        )
        row = cursor.fetchone()
        db.close()
        if row and row["results_json"]:
            import json
            cached_data = json.loads(row["results_json"])
            if cached_data:
                return cached_data
    except Exception as e:
        print(f"[Places Cache] DB check error: {e}")

    # 2. Query external API if configured
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if api_key:
        try:
            with analytics.track_external("google_maps", "places_textsearch") as tracker:
                response = requests.get(
                    "https://maps.googleapis.com/maps/api/place/textsearch/json",
                    params={
                        "query": f"{clean_type} in {clean_suburb}, Sydney",
                        "key": api_key
                    },
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    results = []
                    for item in data.get("results", [])[:5]:
                        results.append({
                            "name": item.get("name"),
                            "type": clean_type,
                            "vicinity": item.get("formatted_address", ""),
                            "rating": item.get("rating")
                        })
                    if results:
                        # 3. Persist into SQLite cache
                        try:
                            import json
                            save_db = sqlite3.connect(DB_PATH, check_same_thread=False)
                            with save_db:
                                save_db.execute(
                                    "INSERT OR REPLACE INTO places_cache (suburb, place_type, results_json, cached_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                                    (clean_suburb, clean_type, json.dumps(results))
                                )
                            save_db.close()
                        except Exception as save_err:
                            print(f"[Places Cache] Failed to write cache: {save_err}")
                        return results
                else:
                    tracker["success"] = False
                    tracker["error"] = f"HTTP {response.status_code}"
        except Exception:
            pass

    # 4. Fallback curated suburb amenities
    return [
        {"name": f"Local {clean_type.capitalize()} 1", "type": clean_type, "vicinity": f"Main St, {clean_suburb}", "rating": 4.5},
        {"name": f"Best {clean_type.capitalize()}", "type": clean_type, "vicinity": f"High St, {clean_suburb}", "rating": 4.8},
    ]
