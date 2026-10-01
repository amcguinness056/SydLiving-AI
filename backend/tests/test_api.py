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
    assert user2["auth_provider"] == "google"

def test_saved_properties_sync_and_toggle():
    # Login to get a valid user
    login_res = client.post("/api/auth/login?username=synctest_user")
    assert login_res.status_code == 200
    user_id = login_res.json()["id"]

    # Get sample properties
    search_res = client.get("/api/properties")
    props = search_res.json()["results"]
    assert len(props) >= 2
    pid1, pid2 = props[0]["id"], props[1]["id"]

    headers = {"user-id": user_id}

    # 1. Sync local properties
    sync_res = client.post("/api/properties/saved/sync", json={"property_ids": [pid1]}, headers=headers)
    assert sync_res.status_code == 200
    synced = sync_res.json()
    assert any(p["id"] == pid1 for p in synced)

    # 2. Save another property
    save_res = client.post(f"/api/properties/saved/{pid2}", headers=headers)
    assert save_res.status_code == 200

    # 3. Verify get_saved_properties returns both
    get_res = client.get("/api/properties/saved", headers=headers)
    assert get_res.status_code == 200
    saved_list = get_res.json()
    saved_ids = [p["id"] for p in saved_list]
    assert pid1 in saved_ids
    assert pid2 in saved_ids

    # 4. Unsave property 1
    unsave_res = client.delete(f"/api/properties/saved/{pid1}", headers=headers)
    assert unsave_res.status_code == 200

    # 5. Verify property 1 is removed and property 2 remains
    final_res = client.get("/api/properties/saved", headers=headers)
    final_ids = [p["id"] for p in final_res.json()]
    assert pid1 not in final_ids
    assert pid2 in final_ids

def test_saved_properties_pruning_and_filtering():
    """Verify property_ids filtering, orphaned ID pruning in sync, and 404 on nonexistent property save."""
    # 1. Fetch valid properties
    search_res = client.get("/api/properties")
    props = search_res.json()["results"]
    assert len(props) >= 3
    valid_ids = [props[0]["id"], props[1]["id"]]
    fake_ids = ["99999999_fake", "18328999_fake"]

    # 2. Test GET /api/properties?property_ids=...
    filter_res = client.get(f"/api/properties?property_ids={valid_ids[0]}&property_ids={valid_ids[1]}")
    assert filter_res.status_code == 200
    filtered_props = filter_res.json()["results"]
    assert len(filtered_props) == 2
    assert set(p["id"] for p in filtered_props) == set(valid_ids)

    # 3. Login test user
    login_res = client.post("/api/auth/login?username=prunetest_user")
    assert login_res.status_code == 200
    user_id = login_res.json()["id"]
    headers = {"user-id": user_id}

    # 4. Sync mixed valid and fake IDs -> only valid IDs should be saved
    sync_res = client.post(
        "/api/properties/saved/sync",
        json={"property_ids": [valid_ids[0], fake_ids[0], valid_ids[1], fake_ids[1]]},
        headers=headers
    )
    assert sync_res.status_code == 200
    synced = sync_res.json()
    assert len(synced) == 2
    synced_ids = [p["id"] for p in synced]
    assert set(synced_ids) == set(valid_ids)

    # 5. Saving a nonexistent property directly must return 404
    save_fake = client.post(f"/api/properties/saved/{fake_ids[0]}", headers=headers)
    assert save_fake.status_code == 404


def test_user_profile_crud():
    """Verify getting and updating a user's relocation and lifestyle profile."""
    # 1. Login user
    login_res = client.post("/api/auth/login?username=profile_tester")
    assert login_res.status_code == 200
    user_id = login_res.json()["id"]

    # 2. Get profile
    profile_res = client.get(f"/api/user/profile?user_id={user_id}")
    assert profile_res.status_code == 200
    prof = profile_res.json()
    assert prof["username"] == "profile_tester"
    assert "workplace_hub" in prof

    # 3. Update profile
    update_res = client.put(f"/api/user/profile?user_id={user_id}", json={
        "workplace_hub": "Barangaroo",
        "max_commute_mins": 35,
        "max_weekly_rent": 920.0,
        "min_bedrooms": 2,
        "has_pets": True,
        "needs_parking": True,
        "lifestyle_vibes": ["Beach Lover", "Great Coffee & Cafes"],
        "preferred_transit_modes": ["metro", "ferry"],
        "kai_verbosity": "concise"
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["workplace_hub"] == "Barangaroo"
    assert updated["max_commute_mins"] == 35
    assert updated["max_weekly_rent"] == 920.0
    assert updated["min_bedrooms"] == 2
    assert updated["has_pets"] is True
    assert updated["needs_parking"] is True
    assert "Beach Lover" in updated["lifestyle_vibes"]
    assert "metro" in updated["preferred_transit_modes"]
    assert updated["kai_verbosity"] == "concise"

def test_property_feature_filters():
    """Verify filtering properties by pet-friendly, parking, and air-conditioning."""
    res_pets = client.get("/api/properties?pet_friendly=true")
    assert res_pets.status_code == 200
    props = res_pets.json()["results"]
    assert len(props) > 0
    assert all(p["pet_friendly"] is True for p in props)

    res_parking = client.get("/api/properties?needs_parking=true")
    assert res_parking.status_code == 200
    props_park = res_parking.json()["results"]
    assert len(props_park) > 0
    assert all(p["parking_spaces"] >= 1 for p in props_park)

    res_aircon = client.get("/api/properties?has_air_con=true")
    assert res_aircon.status_code == 200
    props_ac = res_aircon.json()["results"]
    assert len(props_ac) > 0
    assert all(p["has_air_con"] is True for p in props_ac)

def test_listing_sync_endpoint():
    """Verify that POST /api/sync/listings syncs active listings."""
    res = client.post("/api/sync/listings")
    assert res.status_code == 200
    data = res.json()
    assert data["synced_count"] > 0
    assert "Successfully" in data["message"]

def test_session_titler_heuristics():
    """Verify heuristic title cleaning removes preambles, property links, and mid-word cuts."""
    from session_titler import clean_heuristic_title
    
    t1 = clean_heuristic_title("Give me your candid insider evaluation of [Modern 1BR Apartment - 7/150 Wells Street](property:18328999) in Newtown.")
    assert "Modern 1BR Apartment" in t1
    assert "candid insider" not in t1.lower()
    assert "property:18328999" not in t1

    t2 = clean_heuristic_title("How is the coastal and beach lifestyle near [Modern 1BR Apartment - 7/150 Wells Street](property:18328999)?")
    assert "Modern 1BR Apartment" in t2
    assert "how is the" not in t2.lower()

    t3 = clean_heuristic_title("[Deep] Show 2-bedroom rentals near Sydney Metro stations with high walkability")
    assert not t3.startswith("[Deep]")
    assert "2-bedroom rentals" in t3

def test_chat_session_rename_endpoint():
    """Verify PATCH /api/chat/sessions/{session_id} updates session title."""
    import uuid
    # Create user via login endpoint
    login_res = client.post("/api/auth/login?username=session_tester")
    assert login_res.status_code == 200
    user_id = login_res.json()["id"]
    session_id = str(uuid.uuid4())
    
    # Create session in db
    import sqlite3
    from database import DB_PATH
    conn = sqlite3.connect(DB_PATH)
    conn.execute("INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))", (session_id, user_id, "Old Title"))
    conn.commit()
    conn.close()

    # Update session title
    patch_res = client.patch(f"/api/chat/sessions/{session_id}", headers={"user-id": user_id}, json={"title": "Coogee Beach 2BR Value Check"})
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["title"] == "Coogee Beach 2BR Value Check"

    # Verify get sessions returns new title
    get_res = client.get("/api/chat/sessions", headers={"user-id": user_id})
    assert get_res.status_code == 200
    sessions = get_res.json()["sessions"]
    assert any(s["id"] == session_id and s["title"] == "Coogee Beach 2BR Value Check" for s in sessions)

