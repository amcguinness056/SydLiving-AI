from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_search_properties():
    # Test getting properties (should return seeded data)
    response = client.get("/api/properties")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert "total" in data
    # Might be empty if DB isn't seeded in test env, but endpoint should work
    assert isinstance(data["results"], list)

def test_search_properties_with_filters():
    # Test with filters
    response = client.get("/api/properties?suburbs=Coogee&max_rent=1000&min_bedrooms=2")
    assert response.status_code == 200
    data = response.json()
    
    # Verify filters applied (if data exists)
    for prop in data["results"]:
        assert prop["suburb"] == "Coogee"
        assert prop["weekly_rent"] <= 1000
        assert prop["bedrooms"] >= 2

def test_get_commute():
    # Test valid origin/dest (capitalization matches seed data)
    response = client.get("/api/commute?origin_suburb=Coogee&destination_cbd_hub=Barangaroo")
    assert response.status_code == 200
    data = response.json()
    assert "commutes" in data
    assert isinstance(data["commutes"], list)

def test_get_commute_no_match():
    # Test invalid inputs
    response = client.get("/api/commute?origin_suburb=FakePlace&destination_cbd_hub=Unknown")
    assert response.status_code == 200
    data = response.json()
    assert data["commutes"] == []

def test_chat_no_api_key():
    import os
    # Ensure key is missing for this test
    if "GEMINI_API_KEY" in os.environ:
        del os.environ["GEMINI_API_KEY"]
    
    response = client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 200
    data = response.json()
    assert "GEMINI_API_KEY is not set" in data["reply"]
    assert data["actions"] == []

def test_login_and_google_auth():
    # Test classic login
    resp1 = client.post("/api/auth/login?username=testuser_aaron")
    assert resp1.status_code == 200
    user1 = resp1.json()
    assert user1["username"] == "testuser_aaron"
    assert "id" in user1

    # Test Google auth
    resp2 = client.post("/api/auth/google", json={
        "name": "Aaron McGuinness",
        "email": "aaron@example.com",
        "avatar_url": "https://example.com/avatar.png"
    })
    assert resp2.status_code == 200
    user2 = resp2.json()
    assert user2["username"] == "Aaron McGuinness"
    assert user2["email"] == "aaron@example.com"
    assert user2["avatar_url"] == "https://example.com/avatar.png"
    assert user2["auth_provider"] == "google"


