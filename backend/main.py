import sqlite3
import traceback
import uuid
import os
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, Query, HTTPException, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from database import get_db_connection
from models import (
    PropertySearchResponse, Property, CommuteResponse, CommuteMatrix,
    ChatRequest, ChatResponse, AgentAction, DeparturesResponse, DepartureInfo,
    CacheStatsResponse, SemanticSearchRequest, TradeoffOption, HubsResponse, DestinationHub,
    IsochroneResponse, IsochroneSuburb, User, ChatSession,
    ChatMessage, ChatSessionResponse, ChatMessageResponse, PlaceResponse
)
from tfnsw_client import tfnsw_client
from domain_client import domain_client
from cache import commute_cache, property_cache, departure_cache
from semantic_search import semantic_engine
from session_store import session_store
from lease_audit import lease_auditor, LeaseAuditResult
from orchestrator import orchestrator
from favorites_alerts import favorites_store, AlertCreateRequest, AlertSubscription
from heatmap import generate_commute_cost_heatmap, SuburbHeatmapPoint
from integrations import fetch_domain_properties, fetch_google_commute, fetch_google_places
import agent

app = FastAPI(title="SydLiving AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_current_user(user_id: Optional[str] = Header(None)):
    if not user_id:
        return None
    return user_id

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/hubs", response_model=HubsResponse)
def get_hubs(db: sqlite3.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM destination_hubs ORDER BY name ASC")
    rows = cursor.fetchall()
    hubs = [DestinationHub(**dict(row)) for row in rows]
    return HubsResponse(hubs=hubs)

@app.get("/api/isochrones", response_model=IsochroneResponse)
def get_isochrones(
    destination_hub: str = Query("Barangaroo", description="The destination hub name or id"),
    max_minutes: int = Query(60, description="Max commute duration in minutes"),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    cursor = db.cursor()
    
    cursor.execute(
        "SELECT * FROM destination_hubs WHERE name = ? OR id = ? LIMIT 1", 
        (destination_hub, destination_hub.lower().replace(" ", "_"))
    )
    hub_row = cursor.fetchone()
    if not hub_row:
        cursor.execute("SELECT * FROM destination_hubs WHERE name LIKE ? LIMIT 1", (f"%{destination_hub}%",))
        hub_row = cursor.fetchone()
    
    if not hub_row:
        cursor.execute("SELECT * FROM destination_hubs WHERE id = 'central' LIMIT 1")
        hub_row = cursor.fetchone()

    hub = DestinationHub(**dict(hub_row))
    
    query = """
        SELECT cm.origin_suburb AS suburb,
               cm.duration_minutes,
               cm.transit_mode,
               cm.transfers,
               cm.peak_frequency_mins,
               AVG(p.latitude) AS latitude,
               AVG(p.longitude) AS longitude
        FROM commute_matrix cm
        JOIN properties p ON cm.origin_suburb = p.suburb
        WHERE (cm.destination_cbd_hub = ? OR cm.destination_cbd_hub LIKE ?)
          AND cm.duration_minutes <= ?
        GROUP BY cm.origin_suburb
        ORDER BY cm.duration_minutes ASC
    """
    cursor.execute(query, (hub.name, f"%{hub.name}%", max_minutes))
    rows = cursor.fetchall()
    
    suburbs = [IsochroneSuburb(**dict(row)) for row in rows]
    return IsochroneResponse(hub=hub, max_minutes=max_minutes, suburbs_within_reach=suburbs)

class GoogleAuthPayload(BaseModel):
    name: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None

@app.post("/api/auth/login")
def login(username: str, db: sqlite3.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    if row:
        return User(**dict(row))
    
    new_id = str(uuid.uuid4())
    cursor.execute("INSERT INTO users (id, username) VALUES (?, ?)", (new_id, username))
    db.commit()
    return User(id=new_id, username=username)

@app.post("/api/auth/google")
def google_auth(payload: GoogleAuthPayload, db: sqlite3.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    if payload.email:
        cursor.execute("SELECT * FROM users WHERE email = ?", (payload.email,))
        row = cursor.fetchone()
        if row:
            cursor.execute("UPDATE users SET username = ?, avatar_url = ? WHERE id = ?", (payload.name, payload.avatar_url, row["id"]))
            db.commit()
            return User(id=row["id"], username=payload.name, email=payload.email, avatar_url=payload.avatar_url, auth_provider="google")
    
    cursor.execute("SELECT * FROM users WHERE username = ?", (payload.name,))
    row = cursor.fetchone()
    if row:
        return User(**dict(row))
    
    new_id = str(uuid.uuid4())
    cursor.execute("INSERT INTO users (id, username, email, avatar_url, auth_provider) VALUES (?, ?, ?, ?, 'google')", 
                   (new_id, payload.name, payload.email, payload.avatar_url))
    db.commit()
    return User(id=new_id, username=payload.name, email=payload.email, avatar_url=payload.avatar_url, auth_provider="google")

@app.get("/api/properties", response_model=PropertySearchResponse)
def search_properties(
    suburbs: Optional[List[str]] = Query(None, description="List of suburbs to filter by"),
    max_rent: Optional[float] = Query(None, description="Maximum weekly rent in AUD"),
    min_bedrooms: Optional[int] = Query(None, description="Minimum number of bedrooms"),
    destination_hub: Optional[str] = Query(None, description="Destination hub for commute calculation"),
    max_commute_mins: Optional[int] = Query(None, description="Maximum commute time in minutes"),
    keyword: Optional[str] = Query(None, description="Keyword search in title"),
    property_type: Optional[str] = Query(None, description="Property type filter"),
    circle: Optional[str] = Query(None, description="Circle filter: lat,lng,radius_m"),
    polygon: Optional[str] = Query(None, description="Polygon filter: lat,lng;lat,lng..."),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    """Searches rental properties with rich filters, commute reach, Domain integration, and spatial drawing."""
    if circle or polygon or keyword or property_type or destination_hub:
        params = []
        if destination_hub:
            query = """
                SELECT p.*, 
                       cm.duration_minutes AS commute_duration_minutes,
                       cm.transit_mode,
                       cm.transfers,
                       cm.estimated_opal_fare,
                       cm.route_summary
                FROM properties p
                LEFT JOIN commute_matrix cm 
                  ON p.suburb = cm.origin_suburb 
                 AND (cm.destination_cbd_hub = ? OR cm.destination_cbd_hub LIKE ?)
                WHERE 1=1
            """
            params.extend([destination_hub, f"%{destination_hub}%"])
            if max_commute_mins is not None:
                query += " AND cm.duration_minutes IS NOT NULL AND cm.duration_minutes <= ?"
                params.append(max_commute_mins)
        else:
            query = "SELECT p.*, NULL AS commute_duration_minutes, NULL AS transit_mode, NULL AS transfers, NULL AS estimated_opal_fare, NULL AS route_summary FROM properties p WHERE 1=1"

        if suburbs:
            placeholders = ','.join('?' * len(suburbs))
            query += f" AND p.suburb IN ({placeholders})"
            params.extend(suburbs)
        if max_rent is not None:
            query += " AND p.weekly_rent <= ?"
            params.append(max_rent)
        if min_bedrooms is not None:
            query += " AND p.bedrooms >= ?"
            params.append(min_bedrooms)
        if keyword:
            query += " AND p.title LIKE ?"
            params.append(f"%{keyword}%")
        if property_type:
            query += " AND p.title LIKE ?"
            params.append(f"%{property_type}%")

        if destination_hub:
            query += " ORDER BY cm.duration_minutes ASC, p.weekly_rent ASC"
        else:
            query += " ORDER BY p.weekly_rent ASC"
            
        cursor = db.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        results = [Property(**dict(row)) for row in rows]
        
        if circle:
            try:
                clat, clng, cradius = map(float, circle.split(','))
                from math import radians, sin, cos, sqrt, atan2
                def calc_distance(lat1, lon1, lat2, lon2):
                    R = 6371000
                    dlat = radians(lat2 - lat1)
                    dlon = radians(lon2 - lon1)
                    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
                    c = 2 * atan2(sqrt(a), sqrt(1-a))
                    return R * c
                results = [p for p in results if calc_distance(clat, clng, p.latitude, p.longitude) <= cradius]
            except Exception as e:
                print("Circle filter error:", e)
                
        if polygon:
            try:
                points = [tuple(map(float, pt.split(','))) for pt in polygon.split(';') if pt]
                def point_in_poly(lat, lng, poly):
                    n = len(poly)
                    inside = False
                    p1x, p1y = poly[0]
                    for i in range(1, n + 1):
                        p2x, p2y = poly[i % n]
                        if min(p1y, p2y) < lng <= max(p1y, p2y):
                            if lat <= max(p1x, p2x):
                                if p1y != p2y:
                                    xinters = (lng - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                                if p1x == p2x or lat <= xinters:
                                    inside = not inside
                        p1x, p1y = p2x, p2y
                    return inside
                results = [p for p in results if point_in_poly(p.latitude, p.longitude, points)]
            except Exception as e:
                print("Polygon filter error:", e)

        return PropertySearchResponse(results=results, total=len(results))

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

@app.get("/api/properties/saved")
def get_saved_properties(user_id: str = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db_connection)):
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    cursor = db.cursor()
    cursor.execute('''
        SELECT p.* FROM properties p
        JOIN saved_properties sp ON p.id = sp.property_id
        WHERE sp.user_id = ?
    ''', (user_id,))
    rows = cursor.fetchall()
    return [Property(**dict(row)) for row in rows]

@app.post("/api/properties/saved/{property_id}")
def save_property(property_id: str, user_id: str = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db_connection)):
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    cursor = db.cursor()
    try:
        cursor.execute("INSERT INTO saved_properties (user_id, property_id) VALUES (?, ?)", (user_id, property_id))
        db.commit()
    except sqlite3.IntegrityError:
        pass
    return {"status": "ok"}

@app.delete("/api/properties/saved/{property_id}")
def unsave_property(property_id: str, user_id: str = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db_connection)):
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    cursor = db.cursor()
    cursor.execute("DELETE FROM saved_properties WHERE user_id = ? AND property_id = ?", (user_id, property_id))
    db.commit()
    return {"status": "ok"}

@app.get("/api/commute", response_model=CommuteResponse)
def get_commute(
    origin_suburb: str = Query(..., description="The origin suburb"),
    destination_cbd_hub: str = Query(..., description="The destination CBD hub"),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    """Calculates door-to-door transit commute times using TfNSW Trip Planner API with database fallback."""
    try:
        trip = tfnsw_client.trip_planner(origin_suburb, destination_cbd_hub)
        if trip and trip.get("duration_minutes", 0) > 0:
            commute_item = CommuteMatrix(
                origin_suburb=trip.get("origin", origin_suburb),
                destination_cbd_hub=trip.get("destination", destination_cbd_hub),
                transit_mode=trip.get("transit_mode", "Transit"),
                duration_minutes=trip.get("duration_minutes", 30),
                peak_frequency_mins=trip.get("peak_frequency_mins", 10),
                transfers=trip.get("transfers", 0),
                is_live_data=trip.get("is_live_data", False),
                estimated_opal_fare=trip.get("estimated_opal_fare", 4.20),
                route_summary=trip.get("route_summary", "")
            )
            return CommuteResponse(commutes=[commute_item])

        cursor = db.cursor()
        cursor.execute('''
            SELECT * FROM commute_matrix 
            WHERE (origin_suburb = ? OR origin_suburb LIKE ?) 
              AND (destination_cbd_hub = ? OR destination_cbd_hub LIKE ?)
        ''', (origin_suburb, f"%{origin_suburb}%", destination_cbd_hub, f"%{destination_cbd_hub}%"))
        
        rows = cursor.fetchall()
        if not rows:
            return CommuteResponse(commutes=[])
        results = [CommuteMatrix(**dict(row)) for row in rows]
        return CommuteResponse(commutes=results)
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

@app.get("/api/places", response_model=PlaceResponse)
def get_places(
    suburb: str = Query(..., description="The suburb to search for places"),
    type: str = Query("cafe", description="Type of place (e.g., cafe, gym, transit_station)")
):
    places = fetch_google_places(suburb, type)
    return PlaceResponse(places=places)

@app.get("/api/chat/sessions", response_model=ChatSessionResponse)
def get_chat_sessions(user_id: str = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db_connection)):
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    cursor = db.cursor()
    cursor.execute("SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC", (user_id,))
    rows = cursor.fetchall()
    return ChatSessionResponse(sessions=[ChatSession(**dict(row)) for row in rows])

@app.get("/api/chat/sessions/{session_id}/messages", response_model=ChatMessageResponse)
def get_chat_messages(session_id: str, user_id: str = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db_connection)):
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    cursor = db.cursor()
    cursor.execute("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Session not found")
    
    cursor.execute("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
    rows = cursor.fetchall()
    return ChatMessageResponse(messages=[ChatMessage(**dict(row)) for row in rows])

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, db: sqlite3.Connection = Depends(get_db_connection)):
    try:
        session_id = request.session_id or "default-session"
        cursor = db.cursor()
        now = datetime.now().isoformat()
        
        if request.user_id:
            if not session_id or session_id == "default-session":
                session_id = str(uuid.uuid4())
                title = request.message[:30] + "..." if len(request.message) > 30 else request.message
                cursor.execute(
                    "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (session_id, request.user_id, title, now, now)
                )
            
            if session_id:
                msg_id = str(uuid.uuid4())
                cursor.execute(
                    "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                    (msg_id, session_id, "user", request.message, now)
                )
                cursor.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, session_id))
                db.commit()

        result = await agent.process_chat(
            message=request.message,
            history=request.history or [],
            session_id=session_id
        )

        if request.user_id and session_id:
            msg_id = str(uuid.uuid4())
            now_resp = datetime.now().isoformat()
            cursor.execute(
                "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                (msg_id, session_id, "model", result["reply"], now_resp)
            )
            cursor.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now_resp, session_id))
            db.commit()

        tradeoff_items = [
            TradeoffOption(**t) if isinstance(t, dict) else t
            for t in result.get("tradeoffs", [])
        ]
        
        actions = [AgentAction(**action) for action in result.get("actions", [])]
        if request.user_id and session_id:
            actions.append(AgentAction(action_type="set_session", data={"session_id": session_id}))

        return ChatResponse(
            reply=result["reply"],
            actions=actions,
            tradeoffs=tradeoff_items,
            session_preferences=result.get("session_preferences")
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- Phase 4: Favorites & Alerts ---

@app.get("/api/favorites")
def get_favorites_endpoint(session_id: str = Query("default-session")):
    """Retrieves saved favorite properties for the active user session."""
    return {"favorites": favorites_store.get_favorites(session_id)}

@app.post("/api/favorites")
def add_favorite_endpoint(
    property_data: Dict[str, Any],
    session_id: str = Query("default-session")
):
    """Saves a property to user favorites."""
    fav = favorites_store.add_favorite(session_id, property_data)
    return {"status": "saved", "property": fav}

@app.delete("/api/favorites/{property_id}")
def remove_favorite_endpoint(
    property_id: str,
    session_id: str = Query("default-session")
):
    """Removes a property from user favorites."""
    removed = favorites_store.remove_favorite(session_id, property_id)
    return {"status": "removed" if removed else "not_found", "property_id": property_id}

@app.get("/api/alerts", response_model=List[AlertSubscription])
def get_alerts_endpoint(email: Optional[str] = Query(None)):
    """Retrieves active vacancy alert subscriptions."""
    return favorites_store.get_alerts(email)

@app.post("/api/alerts", response_model=AlertSubscription)
def create_alert_endpoint(req: AlertCreateRequest):
    """Subscribes to automated notifications for matching Sydney rentals."""
    return favorites_store.create_alert(req)

@app.delete("/api/alerts/{alert_id}")
def delete_alert_endpoint(alert_id: str):
    """Cancels an alert subscription."""
    deleted = favorites_store.delete_alert(alert_id)
    return {"status": "deleted" if deleted else "not_found", "alert_id": alert_id}

# --- Phase 4: Commute-Cost Heatmap ---

@app.get("/api/heatmap/commute-cost", response_model=List[SuburbHeatmapPoint])
def get_commute_cost_heatmap(destination_hub: str = Query("Martin Place")):
    """Returns Sydney suburb commute vs weekly rent efficiency heatmap metrics."""
    return generate_commute_cost_heatmap(destination_hub=destination_hub)
