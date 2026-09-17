import sqlite3
import traceback
from fastapi import FastAPI, Depends, Query, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any

from database import get_db_connection
from models import (
    PropertySearchResponse, Property, CommuteResponse, CommuteMatrix,
    ChatRequest, ChatResponse, AgentAction, DeparturesResponse, DepartureInfo,
    CacheStatsResponse, SemanticSearchRequest, TradeoffOption
)
from tfnsw_client import tfnsw_client
from domain_client import domain_client
from cache import commute_cache, property_cache, departure_cache
from semantic_search import semantic_engine
from session_store import session_store
from lease_audit import lease_auditor, LeaseAuditResult
from orchestrator import orchestrator
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

@app.post("/api/properties/semantic-search", response_model=PropertySearchResponse)
def semantic_search_properties(req: SemanticSearchRequest):
    """Semantic vector search over property listings and suburb vibes."""
    try:
        raw_listings = domain_client.search_listings(
            suburb=req.suburbs[0] if req.suburbs else None,
            max_rent=req.max_rent,
            min_bedrooms=req.min_bedrooms
        )
        ranked = semantic_engine.rank_properties_by_vibe(req.vibe, raw_listings, top_k=20)
        results = [Property(**p) for p in ranked]
        return PropertySearchResponse(results=results, total=len(results))
    except Exception as e:
        print(f"Error in semantic_search_properties: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/session/preferences")
def get_session_preferences(session_id: str = Query("default-session")):
    """Retrieves stored user relocation preferences for a session."""
    return session_store.get_or_create(session_id)

@app.delete("/api/session/preferences")
def delete_session_preferences(session_id: str = Query("default-session")):
    """Resets stored user preferences for a session."""
    session_store.clear(session_id)
    return {"status": "session cleared", "session_id": session_id}

@app.post("/api/lease/audit", response_model=LeaseAuditResult)
async def audit_lease_endpoint(
    file: Optional[UploadFile] = File(None),
    lease_text: Optional[str] = Form(None)
):
    """Audits a tenancy agreement or condition report PDF using AWS Textract, Comprehend, and NSW Red Flag rules."""
    try:
        raw_text = ""
        if file:
            content = await file.read()
            raw_text = lease_auditor.extract_document_text(content, filename=file.filename or "lease.pdf")
        elif lease_text:
            raw_text = lease_text
        else:
            raise HTTPException(status_code=400, detail="Either file upload or lease_text must be provided.")

        result = lease_auditor.audit_lease(raw_text)
        return result
    except Exception as e:
        print(f"Error in audit_lease_endpoint: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/orchestrator/search")
def orchestrated_property_search(
    suburb: Optional[str] = Query(None),
    max_rent: Optional[float] = Query(None),
    min_bedrooms: Optional[int] = Query(None),
    destination_hub: str = Query("Martin Place"),
    vibe_query: Optional[str] = Query(None)
):
    """Executes the Step Functions state machine search -> commute -> lifestyle -> trade-offs workflow."""
    try:
        return orchestrator.execute_workflow(
            suburb=suburb,
            max_rent=max_rent,
            min_bedrooms=min_bedrooms,
            destination_hub=destination_hub,
            vibe_query=vibe_query
        )
    except Exception as e:
        print(f"Error in orchestrated_property_search: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        session_id = request.session_id or "default-session"
        print(f"--- Chat Request (Session: {session_id}) ---")
        print(f"Message: {request.message}")
        print(f"History length: {len(request.history or [])}")
        
        result = await agent.process_chat(
            message=request.message,
            history=request.history or [],
            session_id=session_id
        )
        
        tradeoff_items = [
            TradeoffOption(**t) if isinstance(t, dict) else t
            for t in result.get("tradeoffs", [])
        ]
        
        return ChatResponse(
            reply=result["reply"],
            actions=[AgentAction(**action) for action in result.get("actions", [])],
            tradeoffs=tradeoff_items,
            session_preferences=result.get("session_preferences")
        )
    except Exception as e:
        print("!!! ERROR IN /api/chat !!!")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
