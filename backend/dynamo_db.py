"""
DynamoDB Production Data Architecture: Single-Table Design
==========================================================

DESIGN JUSTIFICATION:
---------------------
For SydLivingAI's production deployment on AWS, we adopt Amazon DynamoDB Single-Table
Design using a primary table named `SydLiving-Core` (configured via `DYNAMODB_TABLE_NAME`
with default `SydLiving-Core`), defined with:
  - Primary Key: `PK` (String, Hash/Partition Key)
  - Sort Key:    `SK` (String, Range/Sort Key)
  - Global Secondary Index (GSI1):
      - Partition Key: `GSI1PK` (String)
      - Sort Key:      `GSI1SK` (String)

Why Single-Table Design over Multi-Table for SydLivingAI:
1. Operational & Billing Efficiency:
   - In AWS Serverless (Pay-Per-Request / On-Demand billing), managing 5 separate tables
     (Properties, CommuteMatrix, UserSessions, Favorites, Alerts) creates fragmented
     capacity monitoring, multiple CloudWatch alarm suites, and isolated backup plans.
     A single table unifies continuous backup (Point-in-Time Recovery), encryption with AWS
     KMS, and scaling under one managed resource.

2. Atomic Multi-Item Transactions:
   - Relocation workflows require transactional coordination: e.g. adding a property
     to a user shortlist while incrementing aggregate interest, or atomically persisting
     session preferences alongside audit history. DynamoDB `TransactWriteItems` operates
     seamlessly within a single table without cross-table latency penalties.

3. Entity Mapping Patterns:
   - Property Entity:
       PK: "PROP#<property_id>"
       SK: "METADATA"
       GSI1PK: "SUBURB#<suburb>"
       GSI1SK: "RENT#<weekly_rent:08.2f>"  (enables range queries by rent within suburb)
   - Commute Matrix Entity:
       PK: "COMMUTE#<origin_suburb>"
       SK: "DEST#<destination_cbd_hub>"
   - Session Preference Entity:
       PK: "SESSION#<session_id>"
       SK: "PREFERENCES"
   - User Favorite Entity:
       PK: "USER#<user_id>"
       SK: "FAVORITE#<property_id>"
       GSI1PK: "PROPERTY#<property_id>"
       GSI1SK: "FAVORITED_BY#<user_id>" (reverse lookup of users interested in property)
   - Alert Subscription Entity:
       PK: "ALERT#<alert_id>"
       SK: "METADATA"
       GSI1PK: "ALERT#ALL"
       GSI1SK: "CREATED#<iso_timestamp>"
   - Lease Audit Entity:
       PK: "AUDIT#<audit_id>"
       SK: "METADATA"

4. Least-Privilege IAM Policy:
   - Lambda execution roles require read/write access to only one DynamoDB table ARN and its
     index (`arn:aws:dynamodb:*:*:table/SydLiving-Core*`), simplifying security compliance.
"""

import os
import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

logger = logging.getLogger("sydliving.dynamodb")
logger.setLevel(logging.INFO)

TABLE_NAME = os.getenv("DYNAMODB_TABLE_NAME", "SydLiving-Core")
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")
USE_DYNAMODB = os.getenv("USE_DYNAMODB", "false").lower() in ("1", "true", "yes")

def _float_to_decimal(obj: Any) -> Any:
    """Recursively convert float types to Decimal for DynamoDB storage."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: _float_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_float_to_decimal(v) for v in obj]
    return obj

def _decimal_to_float(obj: Any) -> Any:
    """Recursively convert Decimal types back to float/int for JSON serialization."""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    elif isinstance(obj, dict):
        return {k: _decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_decimal_to_float(v) for v in obj]
    return obj


class DynamoDBService:
    """
    Production single-table repository interacting with AWS DynamoDB.
    Maintains local in-memory fallback for offline testing or when AWS
    credentials are unconfigured.
    """

    def __init__(self, table_name: str = TABLE_NAME, region_name: str = AWS_REGION):
        self.table_name = table_name
        self.region_name = region_name
        self._dynamodb_resource = None
        self._table = None
        self._is_connected = False
        self._local_storage: Dict[str, Dict[str, Any]] = {}

        if USE_DYNAMODB:
            self._connect()

    def _connect(self):
        try:
            self._dynamodb_resource = boto3.resource("dynamodb", region_name=self.region_name)
            self._table = self._dynamodb_resource.Table(self.table_name)
            # Verify table status if possible
            self._table.load()
            self._is_connected = True
            logger.info(f"Connected to DynamoDB single table '{self.table_name}' in {self.region_name}")
        except (ClientError, NoCredentialsError, Exception) as err:
            logger.warning(f"DynamoDB connection to '{self.table_name}' unavailable ({err}). Operating in local fallback mode.")
            self._is_connected = False

    @property
    def is_connected(self) -> bool:
        return self._is_connected

    # -------------------------------------------------------------------------
    # Properties Operations
    # -------------------------------------------------------------------------
    def put_property(self, prop: Dict[str, Any]) -> bool:
        """Store or update property item."""
        prop_id = str(prop["id"])
        suburb = prop.get("suburb", "Unknown")
        rent = float(prop.get("weekly_rent", 0.0))
        rent_sort = f"RENT#{rent:08.2f}"

        item = {
            "PK": f"PROP#{prop_id}",
            "SK": "METADATA",
            "GSI1PK": f"SUBURB#{suburb}",
            "GSI1SK": rent_sort,
            "entity_type": "PROPERTY",
            **prop
        }
        item = _float_to_decimal(item)

        if self._is_connected and self._table:
            try:
                self._table.put_item(Item=item)
                return True
            except Exception as err:
                logger.error(f"Error putting property {prop_id} in DynamoDB: {err}")

        # Local fallback store
        key = (item["PK"], item["SK"])
        self._local_storage[key] = item
        return True

    def get_property(self, property_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single property by ID."""
        pk = f"PROP#{property_id}"
        sk = "METADATA"

        if self._is_connected and self._table:
            try:
                res = self._table.get_item(Key={"PK": pk, "SK": sk})
                if "Item" in res:
                    return _decimal_to_float(res["Item"])
            except Exception as err:
                logger.error(f"Error getting property {property_id} from DynamoDB: {err}")

        key = (pk, sk)
        if key in self._local_storage:
            return _decimal_to_float(self._local_storage[key])
        return None

    def query_properties(
        self,
        suburb: Optional[str] = None,
        max_rent: Optional[float] = None,
        min_bedrooms: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Query properties by suburb and filters."""
        results = []
        if self._is_connected and self._table:
            try:
                if suburb:
                    from boto3.dynamodb.conditions import Key, Attr
                    key_condition = Key("GSI1PK").eq(f"SUBURB#{suburb}")
                    if max_rent is not None:
                        key_condition = key_condition & Key("GSI1SK").lte(f"RENT#{max_rent:08.2f}")
                    
                    filter_exp = None
                    if min_bedrooms is not None and min_bedrooms > 0:
                        filter_exp = Attr("bedrooms").gte(min_bedrooms)

                    kwargs = {
                        "IndexName": "GSI1",
                        "KeyConditionExpression": key_condition
                    }
                    if filter_exp:
                        kwargs["FilterExpression"] = filter_exp

                    res = self._table.query(**kwargs)
                    for item in res.get("Items", []):
                        results.append(_decimal_to_float(item))
                    return results
                else:
                    # Scan with entity_type filter
                    from boto3.dynamodb.conditions import Attr
                    filter_exp = Attr("entity_type").eq("PROPERTY")
                    if max_rent is not None:
                        filter_exp = filter_exp & Attr("weekly_rent").lte(Decimal(str(max_rent)))
                    if min_bedrooms is not None and min_bedrooms > 0:
                        filter_exp = filter_exp & Attr("bedrooms").gte(min_bedrooms)

                    res = self._table.scan(FilterExpression=filter_exp)
                    for item in res.get("Items", []):
                        results.append(_decimal_to_float(item))
                    return results
            except Exception as err:
                logger.error(f"Error querying properties from DynamoDB: {err}")

        # Local fallback search
        for (pk, sk), item in self._local_storage.items():
            if item.get("entity_type") == "PROPERTY":
                dec_item = _decimal_to_float(item)
                if suburb and dec_item.get("suburb", "").lower() != suburb.lower():
                    continue
                if max_rent is not None and float(dec_item.get("weekly_rent", 0)) > max_rent:
                    continue
                if min_bedrooms is not None and int(dec_item.get("bedrooms", 0)) < min_bedrooms:
                    continue
                results.append(dec_item)

        return results

    # -------------------------------------------------------------------------
    # Commute Matrix Operations
    # -------------------------------------------------------------------------
    def put_commute(
        self,
        origin: str,
        dest: str,
        transit_mode: str,
        duration_minutes: int,
        peak_frequency_mins: int
    ) -> bool:
        """Store commute itinerary."""
        item = {
            "PK": f"COMMUTE#{origin}",
            "SK": f"DEST#{dest}",
            "origin_suburb": origin,
            "destination_cbd_hub": dest,
            "transit_mode": transit_mode,
            "duration_minutes": duration_minutes,
            "peak_frequency_mins": peak_frequency_mins,
            "entity_type": "COMMUTE"
        }
        item = _float_to_decimal(item)

        if self._is_connected and self._table:
            try:
                self._table.put_item(Item=item)
                return True
            except Exception as err:
                logger.error(f"Error storing commute in DynamoDB: {err}")

        key = (item["PK"], item["SK"])
        self._local_storage[key] = item
        return True

    def get_commute(self, origin: str, dest: str) -> Optional[Dict[str, Any]]:
        """Retrieve commute itinerary between origin and destination."""
        pk = f"COMMUTE#{origin}"
        sk = f"DEST#{dest}"

        if self._is_connected and self._table:
            try:
                res = self._table.get_item(Key={"PK": pk, "SK": sk})
                if "Item" in res:
                    return _decimal_to_float(res["Item"])
            except Exception as err:
                logger.error(f"Error getting commute from DynamoDB: {err}")

        key = (pk, sk)
        if key in self._local_storage:
            return _decimal_to_float(self._local_storage[key])
        return None

    # -------------------------------------------------------------------------
    # User Shortlist / Favorites Operations
    # -------------------------------------------------------------------------
    def add_favorite(self, user_id: str, property_id: str) -> bool:
        """Save a property to user's favorites shortlist."""
        item = {
            "PK": f"USER#{user_id}",
            "SK": f"FAVORITE#{property_id}",
            "GSI1PK": f"PROPERTY#{property_id}",
            "GSI1SK": f"FAVORITED_BY#{user_id}",
            "user_id": user_id,
            "property_id": property_id,
            "entity_type": "FAVORITE"
        }
        if self._is_connected and self._table:
            try:
                self._table.put_item(Item=item)
                return True
            except Exception as err:
                logger.error(f"Error adding favorite to DynamoDB: {err}")

        key = (item["PK"], item["SK"])
        self._local_storage[key] = item
        return True

    def get_favorites(self, user_id: str) -> List[str]:
        """Return list of property IDs favorited by user."""
        pk = f"USER#{user_id}"
        property_ids = []

        if self._is_connected and self._table:
            try:
                from boto3.dynamodb.conditions import Key
                res = self._table.query(
                    KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with("FAVORITE#")
                )
                for item in res.get("Items", []):
                    property_ids.append(item["property_id"])
                return property_ids
            except Exception as err:
                logger.error(f"Error querying favorites from DynamoDB: {err}")

        for (k_pk, k_sk), item in self._local_storage.items():
            if k_pk == pk and k_sk.startswith("FAVORITE#"):
                property_ids.append(item["property_id"])
        return property_ids

    def remove_favorite(self, user_id: str, property_id: str) -> bool:
        """Remove property from favorites shortlist."""
        pk = f"USER#{user_id}"
        sk = f"FAVORITE#{property_id}"

        if self._is_connected and self._table:
            try:
                self._table.delete_item(Key={"PK": pk, "SK": sk})
                return True
            except Exception as err:
                logger.error(f"Error removing favorite from DynamoDB: {err}")

        key = (pk, sk)
        if key in self._local_storage:
            del self._local_storage[key]
        return True

    # -------------------------------------------------------------------------
    # Notification Alerts Operations
    # -------------------------------------------------------------------------
    def create_alert(self, alert_data: Dict[str, Any]) -> str:
        """Create new listing alert subscription."""
        import uuid
        from datetime import datetime
        alert_id = alert_data.get("id") or str(uuid.uuid4())
        created_at = alert_data.get("created_at") or datetime.utcnow().isoformat()

        item = {
            "PK": f"ALERT#{alert_id}",
            "SK": "METADATA",
            "GSI1PK": "ALERT#ALL",
            "GSI1SK": f"CREATED#{created_at}",
            "entity_type": "ALERT",
            "id": alert_id,
            "created_at": created_at,
            **alert_data
        }
        item = _float_to_decimal(item)

        if self._is_connected and self._table:
            try:
                self._table.put_item(Item=item)
                return alert_id
            except Exception as err:
                logger.error(f"Error creating alert in DynamoDB: {err}")

        key = (item["PK"], item["SK"])
        self._local_storage[key] = item
        return alert_id

    def list_alerts(self, email: Optional[str] = None) -> List[Dict[str, Any]]:
        """List active alerts, optionally filtered by email."""
        results = []
        if self._is_connected and self._table:
            try:
                from boto3.dynamodb.conditions import Key, Attr
                kwargs = {
                    "IndexName": "GSI1",
                    "KeyConditionExpression": Key("GSI1PK").eq("ALERT#ALL")
                }
                if email:
                    kwargs["FilterExpression"] = Attr("email").eq(email)
                res = self._table.query(**kwargs)
                for item in res.get("Items", []):
                    results.append(_decimal_to_float(item))
                return results
            except Exception as err:
                logger.error(f"Error listing alerts from DynamoDB: {err}")

        for (pk, sk), item in self._local_storage.items():
            if item.get("entity_type") == "ALERT":
                dec_item = _decimal_to_float(item)
                if email and dec_item.get("email") != email:
                    continue
                results.append(dec_item)
        return results

    # -------------------------------------------------------------------------
    # Session Preferences Operations
    # -------------------------------------------------------------------------
    def save_session_preferences(self, session_id: str, preferences: Dict[str, Any]) -> bool:
        """Persist session preferences."""
        item = {
            "PK": f"SESSION#{session_id}",
            "SK": "PREFERENCES",
            "entity_type": "SESSION",
            "session_id": session_id,
            "preferences": preferences
        }
        item = _float_to_decimal(item)

        if self._is_connected and self._table:
            try:
                self._table.put_item(Item=item)
                return True
            except Exception as err:
                logger.error(f"Error saving session preferences in DynamoDB: {err}")

        key = (item["PK"], item["SK"])
        self._local_storage[key] = item
        return True

    def get_session_preferences(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve stored session preferences."""
        pk = f"SESSION#{session_id}"
        sk = "PREFERENCES"

        if self._is_connected and self._table:
            try:
                res = self._table.get_item(Key={"PK": pk, "SK": sk})
                if "Item" in res:
                    return _decimal_to_float(res["Item"]).get("preferences")
            except Exception as err:
                logger.error(f"Error getting session preferences from DynamoDB: {err}")

        key = (pk, sk)
        if key in self._local_storage:
            return _decimal_to_float(self._local_storage[key]).get("preferences")
        return None

    def clear_session_preferences(self, session_id: str) -> bool:
        """Remove session preferences."""
        pk = f"SESSION#{session_id}"
        sk = "PREFERENCES"

        if self._is_connected and self._table:
            try:
                self._table.delete_item(Key={"PK": pk, "SK": sk})
                return True
            except Exception as err:
                logger.error(f"Error clearing session preferences from DynamoDB: {err}")

        key = (pk, sk)
        if key in self._local_storage:
            del self._local_storage[key]
        return True

# Global singleton
dynamodb_service = DynamoDBService()
