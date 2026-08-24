import os
import sqlite3
import requests
from database import DB_PATH

def fetch_domain_properties(suburb: str, max_rent: float, min_bedrooms: int) -> list:
    api_key = os.environ.get("DOMAIN_API_KEY")
    if api_key:
        try:
            headers = {"X-API-Key": api_key}
            response = requests.post(
                "https://api.domain.com.au/v1/listings/residential/_search",
                headers=headers,
                json={
                    "listingType": "Rent",
                    "locations": [{"name": suburb, "state": "NSW"}],
                    "minBedrooms": min_bedrooms,
                    "price": {"max": max_rent} if max_rent < 99999.0 else {}
                },
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
                        "photo_url": item.get("listing", {}).get("media", [{}])[0].get("url", "https://source.unsplash.com/800x600/?interior")
                    })
                return results
            else:
                print(f"Domain API Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Domain API Exception: {e}")

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
            
        cursor = db.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        db.close()

def fetch_google_commute(origin_suburb: str, destination_cbd_hub: str) -> list:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if api_key:
        try:
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
    api_key = os.environ.get("GOOGLE_API_KEY")
    if api_key:
        try:
            # First need to get suburb coordinates, mock for now
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
        except Exception:
            pass
            
    # Fallback mock data
    return [
        {"name": f"Local {place_type.capitalize()} 1", "type": place_type, "vicinity": f"Main St, {suburb}", "rating": 4.5},
        {"name": f"Best {place_type.capitalize()}", "type": place_type, "vicinity": f"High St, {suburb}", "rating": 4.8},
    ]
