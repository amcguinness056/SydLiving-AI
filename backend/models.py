from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class PropertyBase(BaseModel):
    id: str
    title: str
    suburb: str
    bedrooms: int
    bathrooms: int
    weekly_rent: float
    address: str
    latitude: float
    longitude: float
    distance_to_beach_km: float
    available_date: str
    description: Optional[str] = None
    is_domain_data: Optional[bool] = False
    vibe_score: Optional[float] = None

class Property(PropertyBase):
    pass

class PropertySearchResponse(BaseModel):
    results: List[Property]
    total: int

class CommuteMatrix(BaseModel):
    origin_suburb: str
    destination_cbd_hub: str
    transit_mode: str
    duration_minutes: int
    peak_frequency_mins: int
    transfers: Optional[int] = 0
    is_live_data: Optional[bool] = False

class CommuteResponse(BaseModel):
    commutes: List[CommuteMatrix]

class DepartureInfo(BaseModel):
    line: str
    destination: str
    departure_time: str
    countdown_minutes: int

class DeparturesResponse(BaseModel):
    stop_query: str
    departures: List[DepartureInfo]

class CacheStatsResponse(BaseModel):
    commute_cache: Dict[str, Any]
    property_cache: Dict[str, Any]
    departure_cache: Dict[str, Any]

class TradeoffOption(BaseModel):
    label: str  # "Cheapest", "Fastest Commute", "Best Overall"
    property: Property
    commute_minutes: int
    transit_mode: str
    reasoning: str
    badge_color: str  # "emerald", "blue", "amber"

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []
    session_id: Optional[str] = "default-session"

class AgentAction(BaseModel):
    action_type: str  # e.g., "update_properties", "update_commute", "tradeoff_recommendations"
    data: dict

class ChatResponse(BaseModel):
    reply: str
    actions: List[AgentAction] = []
    tradeoffs: List[TradeoffOption] = []
    session_preferences: Optional[Dict[str, Any]] = None

class SemanticSearchRequest(BaseModel):
    vibe: str
    max_rent: Optional[float] = None
    min_bedrooms: Optional[int] = None
    suburbs: Optional[List[str]] = None
    destination_cbd_hub: Optional[str] = "Martin Place"
