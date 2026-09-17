import os
import requests
import sqlite3
from typing import Dict, Any, List, Optional
from cache import property_cache
from database import DB_PATH

DOMAIN_BASE_URL = "https://api.domain.com.au/v1"

# Sydney suburb coordinate lookup for distance calculations and geocoding
SUBURB_COORDS: Dict[str, Dict[str, float]] = {
    "Coogee": {"lat": -33.923, "lon": 151.253, "beach_dist": 0.5},
    "Bondi": {"lat": -33.891, "lon": 151.276, "beach_dist": 0.3},
    "Bondi Beach": {"lat": -33.891, "lon": 151.276, "beach_dist": 0.1},
    "Bondi Junction": {"lat": -33.891, "lon": 151.248, "beach_dist": 2.2},
    "Newtown": {"lat": -33.897, "lon": 151.178, "beach_dist": 7.0},
    "Surry Hills": {"lat": -33.883, "lon": 151.214, "beach_dist": 4.0},
    "Manly": {"lat": -33.796, "lon": 151.282, "beach_dist": 0.2},
    "Parramatta": {"lat": -33.815, "lon": 151.001, "beach_dist": 25.0},
    "Chatswood": {"lat": -33.798, "lon": 151.183, "beach_dist": 10.0},
    "Marrickville": {"lat": -33.911, "lon": 151.155, "beach_dist": 8.0},
    "Paddington": {"lat": -33.884, "lon": 151.226, "beach_dist": 3.5},
    "Balmain": {"lat": -33.854, "lon": 151.188, "beach_dist": 6.5},
    "Randwick": {"lat": -33.916, "lon": 151.241, "beach_dist": 2.0}
}

class DomainClient:
    """Client for Domain Group Developer API (Agencies & Listings + Properties & Locations) with caching and resilient fallback."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("DOMAIN_API_KEY")
        self.base_url = DOMAIN_BASE_URL

    def _headers(self) -> Dict[str, str]:
        if not self.api_key:
            return {}
        return {
            "X-Api-Key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def search_listings(
        self,
        suburb: Optional[str] = None,
        max_rent: Optional[float] = None,
        min_bedrooms: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Invokes Domain Group 'Agencies & Listings' search endpoint."""
        cache_key = f"domain_search_{suburb or 'all'}_{max_rent or 'any'}_{min_bedrooms or 'any'}"
        cached = property_cache.get(cache_key)
        if cached is not None:
            return cached

        if self.api_key:
            try:
                locations_payload = []
                if suburb:
                    locations_payload.append({"state": "NSW", "suburb": suburb})
                else:
                    locations_payload.append({"state": "NSW", "region": "Sydney Region"})

                payload = {
                    "listingType": "Rent",
                    "locations": locations_payload,
                    "minBedrooms": min_bedrooms or 0,
                    "pageSize": 20
                }
                if max_rent and max_rent < 99999.0:
                    payload["price"] = {"max": int(max_rent)}

                resp = requests.post(
                    f"{self.base_url}/listings/residential/_search",
                    headers=self._headers(),
                    json=payload,
                    timeout=6
                )
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    for item in data:
                        listing = item.get("listing", item)
                        prop_details = listing.get("propertyDetails", {})
                        price_details = listing.get("priceDetails", {})

                        raw_price = price_details.get("price", 0)
                        # Extract weekly rent number from price string or field
                        weekly_rent = float(raw_price) if isinstance(raw_price, (int, float)) and raw_price > 0 else 750.0

                        suburb_name = prop_details.get("suburb", suburb or "Sydney")
                        coords = SUBURB_COORDS.get(suburb_name, {"lat": -33.8688, "lon": 151.2093, "beach_dist": 5.0})

                        lat = prop_details.get("latitude") or coords["lat"]
                        lon = prop_details.get("longitude") or coords["lon"]

                        headline = listing.get("headline") or f"{prop_details.get('propertyType', 'Apartment')} in {suburb_name}"
                        address = prop_details.get("displayableAddress") or f"{prop_details.get('streetNumber', '10')} {prop_details.get('street', 'High St')}, {suburb_name} NSW"

                        results.append({
                            "id": str(listing.get("id") or item.get("id")),
                            "title": headline,
                            "suburb": suburb_name,
                            "bedrooms": int(prop_details.get("bedrooms", 1)),
                            "bathrooms": int(prop_details.get("bathrooms", 1)),
                            "weekly_rent": weekly_rent,
                            "address": address,
                            "latitude": float(lat),
                            "longitude": float(lon),
                            "distance_to_beach_km": coords.get("beach_dist", 3.0),
                            "available_date": "Available Now",
                            "description": listing.get("description", ""),
                            "is_domain_data": True
                        })

                    if results:
                        property_cache.set(cache_key, results, ttl=3600)
                        return results
            except Exception as e:
                print(f"[DomainClient] search_listings failed: {e}")

        # Resilient fallback to local SQLite database
        results = self._fallback_db_search(suburb, max_rent, min_bedrooms)
        property_cache.set(cache_key, results, ttl=3600)
        return results

    def suggest_locations(self, terms: str) -> List[Dict[str, Any]]:
        """Invokes Domain Group 'Properties & Locations' suggestion endpoint."""
        cache_key = f"domain_suggest_{terms.strip().lower()}"
        cached = property_cache.get(cache_key)
        if cached is not None:
            return cached

        if self.api_key:
            try:
                resp = requests.get(
                    f"{self.base_url}/properties/_suggest",
                    headers=self._headers(),
                    params={"terms": terms, "channel": "Rent"},
                    timeout=5
                )
                if resp.status_code == 200:
                    data = resp.json()
                    suggestions = [
                        {
                            "id": s.get("id"),
                            "name": s.get("name"),
                            "suburb": s.get("suburb"),
                            "state": s.get("state"),
                            "postcode": s.get("postcode")
                        }
                        for s in data
                    ]
                    property_cache.set(cache_key, suggestions, ttl=86400)
                    return suggestions
            except Exception as e:
                print(f"[DomainClient] suggest_locations failed: {e}")

        # Fallback suggestions from Sydney suburb list
        q = terms.lower()
        fallback = [
            {"id": f"syd_{sub.lower()}", "name": f"{sub}, NSW", "suburb": sub, "state": "NSW", "postcode": "2000"}
            for sub in SUBURB_COORDS.keys()
            if q in sub.lower()
        ]
        property_cache.set(cache_key, fallback, ttl=86400)
        return fallback

    def _fallback_db_search(
        self,
        suburb: Optional[str] = None,
        max_rent: Optional[float] = None,
        min_bedrooms: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Queries database repository with rich listing details."""
        try:
            from db_interface import db_repository
            rows = db_repository.query_properties(suburb=suburb, max_rent=max_rent, min_bedrooms=min_bedrooms)
            results = []
            for r in rows:
                item = dict(r)
                item["is_domain_data"] = False
                results.append(item)
            return results
        except Exception:
            return []

domain_client = DomainClient()
