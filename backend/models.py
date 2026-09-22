from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class DestinationHub(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    hub_type: str

class HubsResponse(BaseModel):
    hubs: List[DestinationHub]

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
    description: Optional[str] = ""
    photo_url: Optional[str] = ""
    is_domain_data: Optional[bool] = False
    vibe_score: Optional[float] = None
    # Enriched commute attributes when destination hub filter is active
    commute_duration_minutes: Optional[int] = None
    transit_mode: Optional[str] = None
    transfers: Optional[int] = None
    estimated_opal_fare: Optional[float] = None
    route_summary: Optional[str] = None

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
    transfers: int = 0
    is_live_data: Optional[bool] = False
    estimated_opal_fare: float = 4.20
    route_summary: str = ""

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

class IsochroneSuburb(BaseModel):
    suburb: str
    latitude: float
    longitude: float
    duration_minutes: int
    transit_mode: str
    transfers: int
    peak_frequency_mins: int

class IsochroneResponse(BaseModel):
    hub: DestinationHub
    max_minutes: int
    suburbs_within_reach: List[IsochroneSuburb]

class Place(BaseModel):
    name: str
    type: str
    vicinity: str
    rating: Optional[float] = None

class PlaceResponse(BaseModel):
    places: List[Place]

class User(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_provider: Optional[str] = "google"

class ChatSession(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: str
    updated_at: str

class ChatMessage(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    created_at: str

class ChatSessionResponse(BaseModel):
    sessions: List[ChatSession]

class ChatMessageResponse(BaseModel):
    messages: List[ChatMessage]

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None
    history: Optional[List[dict]] = []
    session_id: Optional[str] = "default-session"

class AgentAction(BaseModel):
    action_type: str  # e.g., "update_properties", "update_commute_filters", "update_commute", "update_places", "tradeoff_recommendations"
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
