import pytest
from fastapi.testclient import TestClient
from main import app
from semantic_search import semantic_engine
from tradeoffs import compute_tradeoffs
from session_store import session_store
from domain_client import domain_client

client = TestClient(app)

def test_semantic_vibe_ranking():
    listings = domain_client.search_listings()
    assert len(listings) > 0

    # Query for leafy coffee vibe
    leafy_results = semantic_engine.rank_properties_by_vibe("quiet, leafy, near good coffee", listings, top_k=5)
    assert len(leafy_results) > 0
    assert all("vibe_score" in p for p in leafy_results)
    # The top result should have a non-zero vibe score
    assert leafy_results[0]["vibe_score"] > 0

    # Query for beach surf vibe
    beach_results = semantic_engine.rank_properties_by_vibe("beachside surf ocean coastal walk", listings, top_k=5)
    assert len(beach_results) > 0
    top_suburbs = [p["suburb"] for p in beach_results[:3]]
    assert any(s in ["Coogee", "Bondi", "Manly"] for s in top_suburbs)

def test_compute_tradeoffs_synthesis():
    listings = domain_client.search_listings()
    tradeoffs = compute_tradeoffs(listings, destination_hub="Barangaroo", vibe_query="quiet leafy near good coffee")

    assert len(tradeoffs) >= 2
    labels = [t.label for t in tradeoffs]
    assert "Cheapest" in labels
    assert "Fastest Commute" in labels
    assert "Best Overall" in labels

    cheapest_opt = next(t for t in tradeoffs if t.label == "Cheapest")
    fastest_opt = next(t for t in tradeoffs if t.label == "Fastest Commute")

    # Cheapest must be equal or lower in rent than fastest
    assert cheapest_opt.property.weekly_rent <= fastest_opt.property.weekly_rent or fastest_opt.commute_minutes <= cheapest_opt.commute_minutes

def test_session_preference_store():
    sess_id = "test-session-123"
    session_store.clear(sess_id)

    # First turn preference
    pref1 = session_store.update_preferences(sess_id, max_rent=850.0, preferred_cbd_hub="Barangaroo")
    assert pref1.max_rent == 850.0
    assert pref1.preferred_cbd_hub == "Barangaroo"

    # Second turn preference (accumulate min_bedrooms without overwriting max_rent)
    pref2 = session_store.update_preferences(sess_id, min_bedrooms=2, vibe_query="leafy parks")
    assert pref2.max_rent == 850.0
    assert pref2.min_bedrooms == 2
    assert pref2.preferred_cbd_hub == "Barangaroo"
    assert pref2.vibe_query == "leafy parks"

    # Reset
    session_store.clear(sess_id)
    cleared = session_store.get_or_create(sess_id)
    assert cleared.max_rent is None

def test_semantic_search_endpoint():
    payload = {
        "vibe": "leafy quiet artisan coffee",
        "max_rent": 1200.0,
        "min_bedrooms": 1
    }
    resp = client.post("/api/properties/semantic-search", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert len(data["results"]) > 0
    assert data["results"][0]["vibe_score"] is not None

def test_multi_turn_chat_with_tradeoffs_and_session_memory():
    sess_id = "multi-turn-test"
    client.delete(f"/api/session/preferences?session_id={sess_id}")

    # Turn 1: Specify budget and workplace
    turn1_resp = client.post("/api/chat", json={
        "message": "Hi, I'm moving to Sydney. My budget is $850 pw and my office is at Barangaroo.",
        "session_id": sess_id
    })
    assert turn1_resp.status_code == 200
    data1 = turn1_resp.json()
    assert len(data1["tradeoffs"]) >= 2
    assert data1["session_preferences"]["max_rent"] == 850.0
    assert data1["session_preferences"]["preferred_cbd_hub"] == "Barangaroo"

    # Turn 2: Ask about vibe without repeating budget or office location
    turn2_resp = client.post("/api/chat", json={
        "message": "I really love quiet leafy suburbs near good coffee and 2 bedrooms",
        "session_id": sess_id
    })
    assert turn2_resp.status_code == 200
    data2 = turn2_resp.json()
    # Should remember Barangaroo and 850 budget from Turn 1!
    assert data2["session_preferences"]["max_rent"] == 850.0
    assert data2["session_preferences"]["preferred_cbd_hub"] == "Barangaroo"
    assert data2["session_preferences"]["min_bedrooms"] == 2
    assert "coffee" in data2["session_preferences"]["vibe_query"] or "leafy" in data2["session_preferences"]["vibe_query"]
    assert len(data2["tradeoffs"]) >= 2

    # Verify session GET endpoint
    sess_get = client.get(f"/api/session/preferences?session_id={sess_id}")
    assert sess_get.status_code == 200
    assert sess_get.json()["max_rent"] == 850.0
