import time
import threading
from typing import Dict, Any, Optional, List
from pydantic import BaseModel

class UserSessionPreferences(BaseModel):
    session_id: str
    max_rent: Optional[float] = None
    min_bedrooms: Optional[int] = None
    target_suburbs: List[str] = []
    preferred_cbd_hub: Optional[str] = "Martin Place"
    vibe_query: Optional[str] = None
    last_updated: float = 0.0

class SessionStore:
    """Thread-safe in-memory store for maintaining user relocation preferences across chat turns."""

    def __init__(self):
        self._sessions: Dict[str, UserSessionPreferences] = {}
        self._lock = threading.RLock()

    def get_or_create(self, session_id: str) -> UserSessionPreferences:
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = UserSessionPreferences(
                    session_id=session_id,
                    last_updated=time.time()
                )
            return self._sessions[session_id]

    def update_preferences(
        self,
        session_id: str,
        max_rent: Optional[float] = None,
        min_bedrooms: Optional[int] = None,
        suburbs: Optional[List[str]] = None,
        preferred_cbd_hub: Optional[str] = None,
        vibe_query: Optional[str] = None
    ) -> UserSessionPreferences:
        with self._lock:
            pref = self.get_or_create(session_id)
            if max_rent is not None:
                pref.max_rent = max_rent
            if min_bedrooms is not None:
                pref.min_bedrooms = min_bedrooms
            if suburbs is not None and len(suburbs) > 0:
                # Union with existing suburbs to preserve context
                existing = set(pref.target_suburbs)
                existing.update(suburbs)
                pref.target_suburbs = list(existing)
            if preferred_cbd_hub:
                pref.preferred_cbd_hub = preferred_cbd_hub
            if vibe_query:
                pref.vibe_query = vibe_query
            pref.last_updated = time.time()
            return pref

    def clear(self, session_id: str) -> None:
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]

session_store = SessionStore()
