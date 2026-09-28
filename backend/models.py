from pydantic import BaseModel
from typing import List, Optional

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
    description: str = ""
    photo_url: str = ""
    parking_spaces: int = 0
    pet_friendly: bool = False
    has_air_con: bool = False
    inspection_time: str = ""
    is_real_listing: bool = True
    external_url: str = ""
    image_urls: List[str] = []
    features_list: List[str] = []
    agency_name: Optional[str] = ""
    agency_logo: Optional[str] = ""
    agent_name: Optional[str] = ""
    agent_photo: Optional[str] = ""
    agent_phone: Optional[str] = ""
    property_type: Optional[str] = "Apartment"
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
    estimated_opal_fare: float = 4.20
    route_summary: str = ""

class CommuteResponse(BaseModel):
    commutes: List[CommuteMatrix]

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
    workplace_hub: Optional[str] = "Martin Place"
    max_commute_mins: Optional[int] = 45
    max_weekly_rent: Optional[float] = 1000.0
    min_bedrooms: Optional[int] = 1
    has_pets: Optional[bool] = False
    needs_parking: Optional[bool] = False
    lifestyle_vibes: Optional[List[str]] = []
    preferred_transit_modes: Optional[List[str]] = []

class UserProfileUpdate(BaseModel):
    workplace_hub: Optional[str] = None
    max_commute_mins: Optional[int] = None
    max_weekly_rent: Optional[float] = None
    min_bedrooms: Optional[int] = None
    has_pets: Optional[bool] = None
    needs_parking: Optional[bool] = None
    lifestyle_vibes: Optional[List[str]] = None
    preferred_transit_modes: Optional[List[str]] = None

class ListingSyncResponse(BaseModel):
    synced_count: int
    message: str
    source: str

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
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    history: Optional[List[dict]] = []

class AgentAction(BaseModel):
    action_type: str  # e.g., "update_properties", "update_commute_filters", "update_commute", "update_places"
    data: dict

class ChatResponse(BaseModel):
    reply: str
    actions: List[AgentAction] = []
    latency_seconds: Optional[float] = None
    agent_type: Optional[str] = "standard"
