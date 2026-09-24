import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
import json
import sqlite3

from main import app
from database import DB_PATH
import deep_agent

client = TestClient(app)

def test_deep_tools_action_collection():
    """Verify that deep agent tools correctly record actions in contextvars."""
    actions = []
    token = deep_agent._active_actions_collector.set(actions)
    try:
        # Test property query tool
        prop_res = deep_agent.deep_query_properties_tool(suburb="Manly", max_rent=1000.0, min_bedrooms=2)
        prop_data = json.loads(prop_res)
        assert "properties" in prop_data or "error" not in prop_data

        # Test commute tool
        commute_res = deep_agent.deep_get_commute_tool(origin_suburb="Manly", destination_cbd_hub="Barangaroo")
        commute_data = json.loads(commute_res)
        assert "commutes" in commute_data

        # Test places tool
        places_res = deep_agent.deep_get_places_tool(suburb="Manly", place_type="cafe")
        places_data = json.loads(places_res)
        assert "places" in places_data

        # Test commute reach filter tool
        reach_res = deep_agent.deep_filter_by_commute_reach_tool(destination_hub="Barangaroo", max_commute_minutes=35)
        reach_data = json.loads(reach_res)
        assert "matching_properties" in reach_data

        # Check recorded actions
        action_types = [a["action_type"] for a in actions]
        assert "update_properties" in action_types
        assert "update_commute" in action_types
        assert "update_places" in action_types
        assert "update_commute_filters" in action_types
    finally:
        deep_agent._active_actions_collector.reset(token)

def test_chat_deep_endpoint_mocked():
    """Verify that POST /api/chat/deep handles ChatRequest and returns formatted ChatResponse."""
    mock_result = {
        "reply": "Deep Agent analyzed your commute to Barangaroo and filtered rentals.",
        "actions": [
            {"action_type": "update_commute_filters", "data": {"destination_hub": "Barangaroo", "max_commute_minutes": 25}},
            {"action_type": "update_properties", "data": {"suburb": "Crows Nest", "max_rent": 850.0}}
        ],
        "latency_seconds": 3.45,
        "agent_type": "deep_agent"
    }

    with patch("deep_agent.process_deep_chat", new_callable=AsyncMock) as mock_deep:
        mock_deep.return_value = mock_result
        
        response = client.post("/api/chat/deep", json={
            "message": "Find rentals within 25 mins to Barangaroo under $850",
            "history": []
        })

        assert response.status_code == 200
        data = response.json()
        assert data["reply"] == mock_result["reply"]
        assert len(data["actions"]) == 2
        assert data["actions"][0]["action_type"] == "update_commute_filters"
        assert data["actions"][1]["action_type"] == "update_properties"
        assert data["latency_seconds"] == 3.45
        assert data["agent_type"] == "deep_agent"

def test_chat_deep_session_persistence():
    """Verify session tracking in SQLite when user_id is provided."""
    mock_result = {
        "reply": "Here are 2-bed properties in Surry Hills.",
        "actions": [],
        "latency_seconds": 2.1,
        "agent_type": "deep_agent"
    }

    with patch("deep_agent.process_deep_chat", new_callable=AsyncMock) as mock_deep:
        mock_deep.return_value = mock_result

        # Login first to obtain valid user
        login_res = client.post("/api/auth/login?username=deep_test_user")
        assert login_res.status_code == 200
        user_id = login_res.json()["id"]

        response = client.post("/api/chat/deep", json={
            "message": "Find places in Surry Hills",
            "user_id": user_id,
            "history": []
        })
        assert response.status_code == 200
        data = response.json()
        assert any(a["action_type"] == "set_session" for a in data["actions"])
        session_id = next(a["data"]["session_id"] for a in data["actions"] if a["action_type"] == "set_session")

        # Verify messages saved to database
        db = sqlite3.connect(DB_PATH)
        cursor = db.cursor()
        cursor.execute("SELECT content, role FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
        rows = cursor.fetchall()
        db.close()

        assert len(rows) == 2
        assert rows[0][1] == "user"
        assert rows[0][0] == "Find places in Surry Hills"
        assert rows[1][1] == "model"
        assert rows[1][0] == mock_result["reply"]
