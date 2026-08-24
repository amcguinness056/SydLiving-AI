from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_get_hubs():
    response = client.get("/api/hubs")
    assert response.status_code == 200
    data = response.json()
    assert "hubs" in data
    assert len(data["hubs"]) >= 6
    hub_names = [h["name"] for h in data["hubs"]]
    assert "Barangaroo" in hub_names
    assert "Central" in hub_names

def test_get_isochrones():
    response = client.get("/api/isochrones?destination_hub=Barangaroo&max_minutes=30")
    assert response.status_code == 200
    data = response.json()
    assert "hub" in data
    assert "suburbs_within_reach" in data
    assert data["max_minutes"] == 30
    for s in data["suburbs_within_reach"]:
        assert s["duration_minutes"] <= 30

def test_search_properties():
    response = client.get("/api/properties")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert "total" in data
    assert isinstance(data["results"], list)

def test_search_properties_with_commute_filter():
    response = client.get("/api/properties?destination_hub=Barangaroo&max_commute_mins=25")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    for prop in data["results"]:
        assert prop["commute_duration_minutes"] is not None
        assert prop["commute_duration_minutes"] <= 25
        assert prop["transit_mode"] is not None

def test_search_properties_with_filters():
    response = client.get("/api/properties?suburbs=Coogee&max_rent=2500&min_bedrooms=1")
    assert response.status_code == 200
    data = response.json()
    for prop in data["results"]:
        assert prop["suburb"] == "Coogee"
        assert prop["weekly_rent"] <= 2500
        assert prop["bedrooms"] >= 1

def test_get_commute():
    response = client.get("/api/commute?origin_suburb=Coogee&destination_cbd_hub=Central")
    assert response.status_code == 200
    data = response.json()
    assert "commutes" in data
    assert isinstance(data["commutes"], list)

def test_get_commute_no_match():
    response = client.get("/api/commute?origin_suburb=FakePlace&destination_cbd_hub=Unknown")
    assert response.status_code == 200
    data = response.json()
    assert data["commutes"] == []

def test_chat_no_api_key():
    import os
    if "GEMINI_API_KEY" in os.environ:
        del os.environ["GEMINI_API_KEY"]
    
    response = client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 200
    data = response.json()
    assert "GEMINI_API_KEY is not set" in data["reply"]
    assert data["actions"] == []


