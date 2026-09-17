import sqlite3
import traceback
from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from database import get_db_connection
from models import (
    PropertySearchResponse, Property, CommuteResponse, CommuteMatrix,
    ChatRequest, ChatResponse, AgentAction, DeparturesResponse, DepartureInfo,
    CacheStatsResponse
)
from tfnsw_client import tfnsw_client
from domain_client import domain_client
from cache import commute_cache, property_cache, departure_cache
import agent

app = FastAPI(title="SydLiving AI API", version="1.0.0")

# Allow CORS for local development and deployed frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/properties", response_model=PropertySearchResponse)
def search_properties(
    suburbs: Optional[List[str]] = Query(None, description="List of suburbs to filter by"),
    max_rent: Optional[float] = Query(None, description="Maximum weekly rent in AUD"),
    min_bedrooms: Optional[int] = Query(None, description="Minimum number of bedrooms")
):
    """Searches rental properties using Domain Developer API with caching and fallback."""
    try:
        all_results = []
        if suburbs and len(suburbs) > 0:
            for suburb in suburbs:
                suburb_listings = domain_client.search_listings(
                    suburb=suburb,
                    max_rent=max_rent,
                    min_bedrooms=min_bedrooms
                )
                all_results.extend(suburb_listings)
        else:
            all_results = domain_client.search_listings(
                suburb=None,
                max_rent=max_rent,
                min_bedrooms=min_bedrooms
            )

        # Deduplicate results by ID
        seen_ids = set()
        unique_results = []
        for p in all_results:
            pid = p.get("id")
            if pid not in seen_ids:
                seen_ids.add(pid)
                unique_results.append(Property(**p))

        return PropertySearchResponse(results=unique_results, total=len(unique_results))
    except Exception as e:
        print(f"Error in search_properties: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/commute", response_model=CommuteResponse)
def get_commute(
    origin_suburb: str = Query(..., description="The origin suburb"),
    destination_cbd_hub: str = Query(..., description="The destination CBD hub")
):
    """Calculates door-to-door transit commute times using TfNSW Trip Planner API."""
    try:
        trip = tfnsw_client.trip_planner(origin_suburb, destination_cbd_hub)
        if not trip:
            return CommuteResponse(commutes=[])

        commute_item = CommuteMatrix(
            origin_suburb=trip.get("origin", origin_suburb),
            destination_cbd_hub=trip.get("destination", destination_cbd_hub),
            transit_mode=trip.get("transit_mode", "Transit"),
            duration_minutes=trip.get("duration_minutes", 30),
            peak_frequency_mins=trip.get("peak_frequency_mins", 10),
            transfers=trip.get("transfers", 0),
            is_live_data=trip.get("is_live_data", False)
        )
        return CommuteResponse(commutes=[commute_item])
    except Exception as e:
        print(f"Error in get_commute: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/departures", response_model=DeparturesResponse)
def get_departures(
    stop_query: str = Query(..., description="Station or suburb name (e.g. 'Bondi Junction', 'Coogee', 'Central')")
):
    """Fetches upcoming real-time departures using TfNSW Departure Monitor API."""
    try:
        departures = tfnsw_client.departures(stop_query)
        dep_items = [DepartureInfo(**d) for d in departures]
        return DeparturesResponse(stop_query=stop_query, departures=dep_items)
    except Exception as e:
        print(f"Error in get_departures: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/locations/suggest")
def suggest_locations(terms: str = Query(..., description="Search terms for suburb or address")):
    """Resolves suburb and address suggestions via Domain Properties & Locations."""
    return domain_client.suggest_locations(terms)

@app.get("/api/cache/stats", response_model=CacheStatsResponse)
def cache_stats():
    """Returns real-time cache performance metrics for TfNSW transit and Domain listings."""
    return CacheStatsResponse(
        commute_cache=commute_cache.stats(),
        property_cache=property_cache.stats(),
        departure_cache=departure_cache.stats()
    )

@app.post("/api/cache/clear")
def clear_cache():
    """Clears all in-memory caches."""
    commute_cache.clear()
    property_cache.clear()
    departure_cache.clear()
    return {"status": "caches cleared"}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        print(f"--- Chat Request ---")
        print(f"Message: {request.message}")
        print(f"History length: {len(request.history or [])}")
        
        result = await agent.process_chat(request.message, request.history or [])
        
        return ChatResponse(
            reply=result["reply"],
            actions=[AgentAction(**action) for action in result.get("actions", [])]
        )
    except Exception as e:
        print("!!! ERROR IN /api/chat !!!")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
