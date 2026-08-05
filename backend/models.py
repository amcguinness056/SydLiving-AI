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

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []

class AgentAction(BaseModel):
    action_type: str  # e.g., "update_properties", "update_commute"
    data: dict

class ChatResponse(BaseModel):
    reply: str
    actions: List[AgentAction] = []
