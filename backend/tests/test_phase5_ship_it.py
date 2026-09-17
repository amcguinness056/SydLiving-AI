"""
Unit tests for Phase 5: Production AWS Serverless Deployment & DynamoDB Migration
"""

import json
import pytest
from decimal import Decimal
import os
import sys

# Ensure backend directory is importable
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from lambda_handler import handler
from dynamo_db import DynamoDBService, _float_to_decimal, _decimal_to_float
from db_interface import db_repository

class MockContext:
    def __init__(self):
        self.function_name = "SydLiving-Backend-Api"
        self.memory_limit_in_mb = 512
        self.invoked_function_arn = "arn:aws:lambda:ap-southeast-2:123456789012:function:SydLiving-Backend-Api"
        self.aws_request_id = "test-request-id-12345"

def test_lambda_handler_warmup_ping():
    """Verify that Lambda handler responds instantly to warmup ping events."""
    event = {"ping": True}
    response = handler(event, MockContext())
    assert response["statusCode"] == 200
    assert response["body"] == "pong"

def test_lambda_handler_api_gateway_request():
    """Verify that Mangum handles an API Gateway HTTP API v2.0 event."""
    event = {
        "version": "2.0",
        "routeKey": "GET /api/cache/stats",
        "rawPath": "/api/cache/stats",
        "rawQueryString": "",
        "headers": {
            "accept": "application/json",
            "host": "test.execute-api.ap-southeast-2.amazonaws.com"
        },
        "requestContext": {
            "accountId": "123456789012",
            "apiId": "testapi",
            "domainName": "test.execute-api.ap-southeast-2.amazonaws.com",
            "http": {
                "method": "GET",
                "path": "/api/cache/stats",
                "protocol": "HTTP/1.1",
                "sourceIp": "127.0.0.1",
                "userAgent": "pytest"
            },
            "requestId": "req-123",
            "routeKey": "GET /api/cache/stats",
            "stage": "$default",
            "time": "18/Sep/2026:00:00:00 +0000",
            "timeEpoch": 1789689600000
        },
        "isBase64Encoded": False
    }

    response = handler(event, MockContext())
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "property_cache" in body
    assert "hits" in body["property_cache"]

def test_dynamodb_type_conversions():
    """Verify recursive conversion between float and Decimal."""
    data = {
        "rent": 850.5,
        "coords": [-33.89, 151.27],
        "nested": {"score": 4.75}
    }
    dec_data = _float_to_decimal(data)
    assert isinstance(dec_data["rent"], Decimal)
    assert isinstance(dec_data["coords"][0], Decimal)
    assert isinstance(dec_data["nested"]["score"], Decimal)

    restored = _decimal_to_float(dec_data)
    assert restored["rent"] == 850.5
    assert restored["coords"] == [-33.89, 151.27]
    assert restored["nested"]["score"] == 4.75

def test_dynamodb_single_table_operations():
    """Verify local fallback storage operations of DynamoDBService."""
    service = DynamoDBService(table_name="Test-Table")

    # 1. Properties
    prop = {
        "id": "prop-dynamo-001",
        "title": "Modern 2BR in Bondi",
        "suburb": "Bondi",
        "weekly_rent": 950.0,
        "bedrooms": 2,
        "bathrooms": 1,
        "address": "100 Campbell Parade, Bondi NSW"
    }
    assert service.put_property(prop) is True
    retrieved_prop = service.get_property("prop-dynamo-001")
    assert retrieved_prop is not None
    assert retrieved_prop["suburb"] == "Bondi"
    assert retrieved_prop["weekly_rent"] == 950.0

    # Query with filters
    results = service.query_properties(suburb="Bondi", max_rent=1000.0, min_bedrooms=2)
    assert any(p["id"] == "prop-dynamo-001" for p in results)

    # Query without match
    no_match = service.query_properties(suburb="Bondi", max_rent=800.0)
    assert not any(p["id"] == "prop-dynamo-001" for p in no_match)

    # 2. Commute matrix
    assert service.put_commute("Bondi", "Martin Place", "Bus", 35, 10) is True
    commute = service.get_commute("Bondi", "Martin Place")
    assert commute is not None
    assert commute["duration_minutes"] == 35
    assert commute["transit_mode"] == "Bus"

    # 3. User favorites
    assert service.add_favorite("user-42", "prop-dynamo-001") is True
    favs = service.get_favorites("user-42")
    assert "prop-dynamo-001" in favs
    assert service.remove_favorite("user-42", "prop-dynamo-001") is True
    favs_after = service.get_favorites("user-42")
    assert "prop-dynamo-001" not in favs_after

    # 4. Alerts
    alert_id = service.create_alert({
        "email": "user@example.com",
        "suburbs": ["Bondi"],
        "max_rent": 950.0,
        "frequency": "daily"
    })
    assert alert_id is not None
    alerts = service.list_alerts(email="user@example.com")
    assert len(alerts) >= 1
    assert alerts[0]["email"] == "user@example.com"

    # 5. Session preferences
    assert service.save_session_preferences("session-abc", {"budget": 950, "vibe": "coastal"}) is True
    prefs = service.get_session_preferences("session-abc")
    assert prefs["budget"] == 950
    assert service.clear_session_preferences("session-abc") is True
    assert service.get_session_preferences("session-abc") is None

def test_db_repository_interface():
    """Verify repository abstraction resolves property and commute data."""
    # Test property query through repository interface
    props = db_repository.query_properties(max_rent=1500)
    assert isinstance(props, list)

    commute = db_repository.get_commute("Coogee", "Central")
    # Might be None or dict depending on seed data in sydliving.db
    if commute:
        assert "duration_minutes" in commute
