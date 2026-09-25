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

def test_get_property_by_id():
    # First search for a property to get a valid ID
    search_res = client.get("/api/properties")
    assert search_res.status_code == 200
    first_prop = search_res.json()["results"][0]
    prop_id = first_prop["id"]

    # Test single property fetch
    res = client.get(f"/api/properties/{prop_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == prop_id
    assert "title" in data
    assert "suburb" in data

    # Test non-existent property
    bad_res = client.get("/api/properties/non-existent-id")
    assert bad_res.status_code == 404

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

def test_login_and_google_auth():
    resp1 = client.post("/api/auth/login?username=testuser_aaron")
    assert resp1.status_code == 200
    user1 = resp1.json()
    assert user1["username"] == "testuser_aaron"
    assert "id" in user1

    resp2 = client.post("/api/auth/google", json={
        "name": "Test Google User",
        "email": "testgoogle@example.com",
        "avatar_url": "https://example.com/avatar.png"
    })
    assert resp2.status_code == 200
    user2 = resp2.json()
    assert user2["username"] == "Test Google User"
    assert user2["email"] == "testgoogle@example.com"
    assert user2["avatar_url"] == "https://example.com/avatar.png"
    assert user2["auth_provider"] == "google"
