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

def test_google_auth_and_session_token(monkeypatch):
    import main

    # Mock verify_google_credential in main where google_auth is defined
    def mock_verify(credential):
        if credential == "valid_admin_token":
            return {
                "sub": "google-sub-admin-123",
                "email": "aaron.manu.td24@gmail.com",
                "email_verified": True,
                "name": "Aaron McGuinness",
                "picture": "https://example.com/aaron.png"
            }
        elif credential == "valid_user_token":
            return {
                "sub": "google-sub-user-456",
                "email": "regular.user@example.com",
                "email_verified": True,
                "name": "Regular User",
                "picture": "https://example.com/user.png"
            }
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid credential")

    monkeypatch.setattr(main, "verify_google_credential", mock_verify)

    # 1. Invalid credential -> 401
    bad_res = client.post("/api/auth/google", json={"credential": "invalid"})
    assert bad_res.status_code == 401

    # 2. Regular user login -> returns token, user, is_admin=False
    user_res = client.post("/api/auth/google", json={"credential": "valid_user_token"})
    assert user_res.status_code == 200
    user_data = user_res.json()
    assert "token" in user_data
    assert user_data["user"]["email"] == "regular.user@example.com"
    assert user_data["is_admin"] is False

    # 3. Admin user login -> returns token, user, is_admin=True
    admin_res = client.post("/api/auth/google", json={"credential": "valid_admin_token"})
    assert admin_res.status_code == 200
    admin_data = admin_res.json()
    assert "token" in admin_data
    assert admin_data["user"]["email"] == "aaron.manu.td24@gmail.com"
    assert admin_data["is_admin"] is True

    # 4. GET /api/auth/me with Bearer token
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_data['token']}"})
    assert me_res.status_code == 200
    assert me_res.json()["is_admin"] is True

def test_saved_properties_sync_and_toggle(monkeypatch):
    import main
    def mock_verify(credential):
        return {
            "sub": "google-sub-sync-user",
            "email": "synctest@example.com",
            "email_verified": True,
            "name": "Sync Test",
            "picture": ""
        }
    monkeypatch.setattr(main, "verify_google_credential", mock_verify)

    login_res = client.post("/api/auth/google", json={"credential": "mock"})
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get sample properties
    search_res = client.get("/api/properties")
    props = search_res.json()["results"]
    assert len(props) >= 2
    pid1, pid2 = props[0]["id"], props[1]["id"]

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

def test_saved_properties_pruning_and_filtering(monkeypatch):
    """Verify property_ids filtering, orphaned ID pruning in sync, and 404 on nonexistent property save."""
    import main
    def mock_verify(credential):
        return {
            "sub": "google-sub-prune-user",
            "email": "prunetest@example.com",
            "email_verified": True,
            "name": "Prune Test",
            "picture": ""
        }
    monkeypatch.setattr(main, "verify_google_credential", mock_verify)

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
    login_res = client.post("/api/auth/google", json={"credential": "mock"})
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

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

def test_user_profile_crud(monkeypatch):
    """Verify getting and updating a user's relocation and lifestyle profile."""
    import main
    def mock_verify(credential):
        return {
            "sub": "google-sub-profile-user",
            "email": "profiletester@example.com",
            "email_verified": True,
            "name": "Profile Tester",
            "picture": ""
        }
    monkeypatch.setattr(main, "verify_google_credential", mock_verify)

    login_res = client.post("/api/auth/google", json={"credential": "mock"})
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get profile
    profile_res = client.get("/api/user/profile", headers=headers)
    assert profile_res.status_code == 200
    prof = profile_res.json()
    assert prof["username"] == "Profile Tester"
    assert "workplace_hub" in prof

    # 3. Update profile
    update_res = client.put("/api/user/profile", headers=headers, json={
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

def test_chat_session_rename_endpoint(monkeypatch):
    """Verify PATCH /api/chat/sessions/{session_id} updates session title with Bearer auth."""
    import main
    def mock_verify(credential):
        return {
            "sub": "google-sub-session-user",
            "email": "sessionuser@example.com",
            "email_verified": True,
            "name": "Session User",
            "picture": ""
        }
    monkeypatch.setattr(main, "verify_google_credential", mock_verify)

    login_res = client.post("/api/auth/google", json={"credential": "mock"})
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    user_id = login_res.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    import uuid
    session_id = str(uuid.uuid4())
    
    # Create session in db
    import sqlite3
    from database import DB_PATH
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))", 
        (session_id, user_id, "Old Title")
    )
    conn.commit()
    conn.close()

    # Update session title
    patch_res = client.patch(f"/api/chat/sessions/{session_id}", headers=headers, json={"title": "Coogee Beach 2BR Value Check"})
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["title"] == "Coogee Beach 2BR Value Check"

    # Verify get sessions returns new title
    get_res = client.get("/api/chat/sessions", headers=headers)
    assert get_res.status_code == 200
    sessions = get_res.json()["sessions"]
    assert any(s["id"] == session_id and s["title"] == "Coogee Beach 2BR Value Check" for s in sessions)

def test_admin_endpoints_security_and_insights(monkeypatch):
    """Verify admin endpoints: 401 without auth, 403 for non-admin, 200 for admin, and correct analytics shapes."""
    import main
    def mock_verify(credential):
        if credential == "admin_creds":
            return {
                "sub": "google-admin-id",
                "email": "aaron.manu.td24@gmail.com",
                "email_verified": True,
                "name": "Aaron McGuinness",
                "picture": ""
            }
        return {
            "sub": "google-regular-id",
            "email": "regular@example.com",
            "email_verified": True,
            "name": "Regular User",
            "picture": ""
        }
    monkeypatch.setattr(main, "verify_google_credential", mock_verify)

    # 1. Unauthenticated request -> 401
    assert client.get("/api/admin/overview").status_code == 401
    assert client.get("/api/admin/users").status_code == 401
    assert client.get("/api/admin/health").status_code == 401

    # 2. Non-admin request -> 403
    reg_login = client.post("/api/auth/google", json={"credential": "user_creds"}).json()
    reg_headers = {"Authorization": f"Bearer {reg_login['token']}"}
    assert client.get("/api/admin/overview", headers=reg_headers).status_code == 403
    assert client.get("/api/admin/users", headers=reg_headers).status_code == 403
    assert client.get("/api/admin/health", headers=reg_headers).status_code == 403

    # 3. Admin request -> 200
    admin_login = client.post("/api/auth/google", json={"credential": "admin_creds"}).json()
    admin_headers = {"Authorization": f"Bearer {admin_login['token']}"}

    overview_res = client.get("/api/admin/overview?range=7d", headers=admin_headers)
    assert overview_res.status_code == 200
    overview_data = overview_res.json()
    assert "total_users" in overview_data
    assert "new_signups" in overview_data
    assert "dau" in overview_data
    assert "signups_over_time" in overview_data

    users_res = client.get("/api/admin/users", headers=admin_headers)
    assert users_res.status_code == 200
    users_list = users_res.json()
    assert isinstance(users_list, list)
    assert len(users_list) > 0
    test_user_id = users_list[0]["id"]

    detail_res = client.get(f"/api/admin/users/{test_user_id}", headers=admin_headers)
    assert detail_res.status_code == 200
    assert "profile" in detail_res.json()
    assert "sessions" in detail_res.json()

    chats_res = client.get("/api/admin/chats?range=7d", headers=admin_headers)
    assert chats_res.status_code == 200
    assert "total_sessions" in chats_res.json()
    assert "recent_prompts" in chats_res.json()

    saved_res = client.get("/api/admin/saved?range=7d", headers=admin_headers)
    assert saved_res.status_code == 200
    assert "total_saves" in saved_res.json()
    assert "top_suburbs" in saved_res.json()

    health_res = client.get("/api/admin/health?range=7d", headers=admin_headers)
    assert health_res.status_code == 200
    assert "requests_over_time" in health_res.json()
    assert "endpoints" in health_res.json()

    # Session transcript test (create a session first, then inspect)
    user_headers = {"Authorization": f"Bearer {admin_login['token']}"}
    session_res = client.post("/api/chat", json={"message": "Admin test inquiry"}, headers=user_headers)
    assert session_res.status_code == 200
    created_sessions = client.get("/api/chat/sessions", headers=user_headers).json()["sessions"]
    if created_sessions:
        sid = created_sessions[0]["id"]
        direct_tr = client.get(f"/api/admin/sessions/{sid}/messages", headers=admin_headers)
        assert direct_tr.status_code == 200
        assert "messages" in direct_tr.json()


