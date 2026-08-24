from pydantic import BaseModel
from typing import List, Optional

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
    description: str
    photo_url: str

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

class CommuteResponse(BaseModel):
    commutes: List[CommuteMatrix]

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
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    history: Optional[List[dict]] = []

class AgentAction(BaseModel):
    action_type: str  # e.g., "update_properties", "update_commute", "update_places"
    data: dict

class ChatResponse(BaseModel):
    reply: str
    actions: List[AgentAction] = []
