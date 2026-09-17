import time
import pytest
from fastapi.testclient import TestClient
from main import app
from cache import TTLCache, commute_cache, property_cache, departure_cache
from tfnsw_client import TfNSWClient, tfnsw_client
from domain_client import DomainClient, domain_client

client = TestClient(app)

def test_ttl_cache_operations():
    cache = TTLCache(default_ttl=1)
    cache.set("foo", "bar")
    assert cache.get("foo") == "bar"
    
    # Hit count check
    stats = cache.stats()
    assert stats["hits"] == 1
    assert stats["misses"] == 0
    assert stats["active_entries"] == 1
    
    # Wait for expiration
    time.sleep(1.1)
    assert cache.get("foo") is None
    assert cache.stats()["misses"] == 1

def test_tfnsw_stop_finder():
    stops = tfnsw_client.stop_finder("Martin Place")
    assert len(stops) > 0
    assert any("Martin Place" in s["name"] or s["id"] == "200060" for s in stops)

def test_tfnsw_trip_planner():
    trip = tfnsw_client.trip_planner("Coogee", "Martin Place")
    assert trip is not None
    assert trip["origin"] == "Coogee"
    assert trip["destination"] == "Martin Place"
    assert trip["duration_minutes"] > 0
    assert "transit_mode" in trip

def test_tfnsw_departures():
    deps = tfnsw_client.departures("Bondi Junction")
    assert len(deps) > 0
    assert "line" in deps[0]
    assert "departure_time" in deps[0]

def test_domain_search_listings():
    results = domain_client.search_listings(suburb="Coogee", max_rent=1200, min_bedrooms=1)
    assert len(results) > 0
    for p in results:
        assert p["suburb"] == "Coogee"
        assert p["weekly_rent"] <= 1200
        assert p["bedrooms"] >= 1
        assert "address" in p
        assert "latitude" in p
        assert "longitude" in p

def test_domain_suggest_locations():
    suggestions = domain_client.suggest_locations("Manly")
    assert len(suggestions) > 0
    assert any("manly" in s["name"].lower() for s in suggestions)

def test_api_commute_door_to_door():
    response = client.get("/api/commute?origin_suburb=Manly&destination_cbd_hub=Circular Quay")
    assert response.status_code == 200
    data = response.json()
    assert "commutes" in data
    assert len(data["commutes"]) == 1
    commute = data["commutes"][0]
    assert commute["origin_suburb"] == "Manly"
    assert commute["destination_cbd_hub"] == "Circular Quay"
    assert commute["duration_minutes"] == 22
    assert "Ferry" in commute["transit_mode"]

def test_api_departures_endpoint():
    response = client.get("/api/departures?stop_query=Central")
    assert response.status_code == 200
    data = response.json()
    assert data["stop_query"] == "Central"
    assert len(data["departures"]) > 0

def test_api_cache_stats_and_clear():
    # Fetch commute to populate cache
    client.get("/api/commute?origin_suburb=Chatswood&destination_cbd_hub=Barangaroo")
    
    stats_resp = client.get("/api/cache/stats")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert "commute_cache" in stats
    assert "property_cache" in stats
    
    # Clear cache
    clear_resp = client.post("/api/cache/clear")
    assert clear_resp.status_code == 200
    assert clear_resp.json() == {"status": "caches cleared"}
