import time
import threading
from typing import Any, Optional, Dict

class TTLCache:
    """Thread-safe in-memory cache with Time-To-Live (TTL) expiration."""
    
    def __init__(self, default_ttl: int = 3600):
        self._default_ttl = default_ttl
        self._store: Dict[str, tuple[Any, float]] = {}
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._store:
                self._misses += 1
                return None
            val, expiry = self._store[key]
            if time.time() > expiry:
                del self._store[key]
                self._misses += 1
                return None
            self._hits += 1
            return val

    def set(self, key: str, val: Any, ttl: Optional[int] = None) -> None:
        ttl = ttl if ttl is not None else self._default_ttl
        expiry = time.time() + ttl
        with self._lock:
            self._store[key] = (val, expiry)

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def stats(self) -> dict:
        with self._lock:
            now = time.time()
            active_keys = sum(1 for _, expiry in self._store.values() if expiry > now)
            total_requests = self._hits + self._misses
            hit_ratio = (self._hits / total_requests) if total_requests > 0 else 0.0
            return {
                "active_entries": active_keys,
                "total_entries": len(self._store),
                "hits": self._hits,
                "misses": self._misses,
                "hit_ratio": round(hit_ratio, 4)
            }

# Global cache instances for transit and property data
commute_cache = TTLCache(default_ttl=1800)      # 30 minutes for transit journeys
property_cache = TTLCache(default_ttl=3600)     # 60 minutes for property listings
departure_cache = TTLCache(default_ttl=300)     # 5 minutes for live station departures
