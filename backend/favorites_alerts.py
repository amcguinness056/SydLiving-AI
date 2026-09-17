import time
import uuid
import threading
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, EmailStr
from models import Property
from domain_client import domain_client

class AlertCreateRequest(BaseModel):
    email: str
    suburbs: Optional[List[str]] = []
    max_rent: Optional[float] = None
    min_bedrooms: Optional[int] = None
    vibe_query: Optional[str] = None
    frequency: str = "daily"  # "instant" or "daily"

class AlertSubscription(BaseModel):
    id: str
    email: str
    suburbs: List[str] = []
    max_rent: Optional[float] = None
    min_bedrooms: Optional[int] = None
    vibe_query: Optional[str] = None
    frequency: str = "daily"
    created_at: float

class FavoritesAndAlertsStore:
    """Thread-safe in-memory and database-backed store for user favorites and alert subscriptions."""

    def __init__(self):
        self._lock = threading.RLock()
        # session_id -> set of property_ids
        self._favorites: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # alert_id -> AlertSubscription
        self._alerts: Dict[str, AlertSubscription] = {}

    def add_favorite(self, session_id: str, property_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            if session_id not in self._favorites:
                self._favorites[session_id] = {}
            pid = property_data.get("id") or str(uuid.uuid4())
            self._favorites[session_id][pid] = property_data
            return property_data

    def remove_favorite(self, session_id: str, property_id: str) -> bool:
        with self._lock:
            if session_id in self._favorites and property_id in self._favorites[session_id]:
                del self._favorites[session_id][property_id]
                return True
            return False

    def get_favorites(self, session_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._favorites.get(session_id, {}).values())

    def is_favorite(self, session_id: str, property_id: str) -> bool:
        with self._lock:
            return property_id in self._favorites.get(session_id, {})

    def create_alert(self, req: AlertCreateRequest) -> AlertSubscription:
        with self._lock:
            alert_id = str(uuid.uuid4())[:8]
            alert = AlertSubscription(
                id=alert_id,
                email=req.email,
                suburbs=req.suburbs or [],
                max_rent=req.max_rent,
                min_bedrooms=req.min_bedrooms,
                vibe_query=req.vibe_query,
                frequency=req.frequency,
                created_at=time.time()
            )
            self._alerts[alert_id] = alert
            return alert

    def get_alerts(self, email: Optional[str] = None) -> List[AlertSubscription]:
        with self._lock:
            if email:
                return [a for a in self._alerts.values() if a.email.lower() == email.lower()]
            return list(self._alerts.values())

    def delete_alert(self, alert_id: str) -> bool:
        with self._lock:
            if alert_id in self._alerts:
                del self._alerts[alert_id]
                return True
            return False

favorites_store = FavoritesAndAlertsStore()
