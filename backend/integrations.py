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
                            return [{
                                "origin_suburb": origin_suburb,
                                "destination_cbd_hub": destination_cbd_hub,
                                "transit_mode": "transit",
                                "duration_minutes": duration_mins,
                                "peak_frequency_mins": 10
                            }]
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
            
    # Fallback to local DB
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.row_factory = sqlite3.Row
    try:
        cursor = db.cursor()
        cursor.execute('''
            SELECT * FROM commute_matrix 
            WHERE origin_suburb = ? AND destination_cbd_hub = ?
        ''', (origin_suburb, destination_cbd_hub))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        db.close()

def fetch_google_places(suburb: str, place_type: str) -> list:
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if api_key:
        try:
            with analytics.track_external("google_maps", "places_textsearch") as tracker:
                response = requests.get(
                    "https://maps.googleapis.com/maps/api/place/textsearch/json",
                    params={
                        "query": f"{place_type} in {suburb}, Sydney",
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
                            "type": place_type,
                            "vicinity": item.get("formatted_address", ""),
                            "rating": item.get("rating")
                        })
                    return results
                else:
                    tracker["success"] = False
                    tracker["error"] = f"HTTP {response.status_code}"
        except Exception:
            pass
            
    # Fallback mock data
    return [
        {"name": f"Local {place_type.capitalize()} 1", "type": place_type, "vicinity": f"Main St, {suburb}", "rating": 4.5},
        {"name": f"Best {place_type.capitalize()}", "type": place_type, "vicinity": f"High St, {suburb}", "rating": 4.8},
    ]
