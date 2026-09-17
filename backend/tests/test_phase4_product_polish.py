import pytest
from fastapi.testclient import TestClient
from main import app
from favorites_alerts import favorites_store
from heatmap import generate_commute_cost_heatmap

client = TestClient(app)

def test_favorites_operations():
    sess_id = "test-fav-session"
    sample_prop = {
        "id": "prop-12345",
        "title": "Stunning Bondi Beachfront 2BR",
        "suburb": "Bondi",
        "weekly_rent": 950.0,
        "bedrooms": 2,
        "bathrooms": 1,
        "address": "10 Campbell Parade, Bondi NSW",
        "latitude": -33.891,
        "longitude": 151.276,
        "distance_to_beach_km": 0.1,
        "available_date": "Available Now"
    }

    # Add favorite
    saved = favorites_store.add_favorite(sess_id, sample_prop)
    assert saved["id"] == "prop-12345"
    assert favorites_store.is_favorite(sess_id, "prop-12345") is True

    # Retrieve favorites
    favs = favorites_store.get_favorites(sess_id)
    assert len(favs) == 1
    assert favs[0]["suburb"] == "Bondi"

    # Remove favorite
    removed = favorites_store.remove_favorite(sess_id, "prop-12345")
    assert removed is True
    assert favorites_store.is_favorite(sess_id, "prop-12345") is False

def test_alerts_subscription():
    alert_req = {
        "email": "user@sydliving.com",
        "suburbs": ["Surry Hills", "Newtown"],
        "max_rent": 800.0,
        "min_bedrooms": 2,
        "vibe_query": "quiet leafy cafes",
        "frequency": "instant"
    }
    resp = client.post("/api/alerts", json=alert_req)
    assert resp.status_code == 200
    alert_data = resp.json()
    assert "id" in alert_data
    assert alert_data["email"] == "user@sydliving.com"
    assert "Surry Hills" in alert_data["suburbs"]

    # Retrieve alerts
    get_resp = client.get(f"/api/alerts?email=user@sydliving.com")
    assert get_resp.status_code == 200
    alerts = get_resp.json()
    assert len(alerts) >= 1

    # Delete alert
    del_resp = client.delete(f"/api/alerts/{alert_data['id']}")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "deleted"

def test_commute_cost_heatmap_generation():
    points = generate_commute_cost_heatmap(destination_hub="Barangaroo")
    assert len(points) >= 10
    
    # Suburb properties check
    for pt in points:
        assert pt.median_rent_weekly > 0
        assert pt.commute_minutes_to_cbd > 0
        assert pt.cost_per_commute_minute > 0
        assert 0 <= pt.efficiency_index <= 100
        assert pt.tier in ["Top Value Sweet Spot", "Solid Balance", "Premium Lifestyle"]

    # Endpoints check
    resp = client.get("/api/heatmap/commute-cost?destination_hub=Martin Place")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 10
    top_efficiency = data[0]
    assert top_efficiency["efficiency_index"] >= data[-1]["efficiency_index"]

def test_favorites_api_endpoints():
    sess_id = "api-test-fav"
    prop_payload = {
        "id": "prop-api-999",
        "title": "Modern Newtown Terrace",
        "suburb": "Newtown",
        "weekly_rent": 720.0,
        "bedrooms": 2,
        "bathrooms": 1,
        "address": "50 King St, Newtown NSW",
        "latitude": -33.897,
        "longitude": 151.178,
        "distance_to_beach_km": 7.0,
        "available_date": "Available Now"
    }

    # POST favorite
    post_res = client.post(f"/api/favorites?session_id={sess_id}", json=prop_payload)
    assert post_res.status_code == 200
    assert post_res.json()["status"] == "saved"

    # GET favorites
    get_res = client.get(f"/api/favorites?session_id={sess_id}")
    assert get_res.status_code == 200
    assert len(get_res.json()["favorites"]) == 1

    # DELETE favorite
    del_res = client.delete(f"/api/favorites/prop-api-999?session_id={sess_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "removed"
