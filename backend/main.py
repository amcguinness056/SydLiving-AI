import os
import sqlite3
import traceback
import uuid
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

from datetime import datetime
from fastapi import FastAPI, Depends, Query, HTTPException, Header, Body, Request
from starlette.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel

import json
import time
import asyncio
import database
import analytics
from auth import (
    get_current_user, require_user, require_admin, verify_google_credential,
    create_session_token, is_admin_email, peek_user_id,
)
from database import get_db_connection
from models import (
    PropertySearchResponse, Property, CommuteResponse, CommuteMatrix, 
    ChatRequest, ChatResponse, AgentAction, HubsResponse, DestinationHub,
    IsochroneResponse, IsochroneSuburb, User, UserProfileUpdate, ListingSyncResponse,
    ChatSession, ChatSessionUpdate, ChatMessage, ChatSessionResponse, ChatMessageResponse, PlaceResponse
)
from integrations import fetch_domain_properties, fetch_google_commute, fetch_google_places
from sync_listings import sync_active_listings
from starlette.middleware.gzip import GZipMiddleware
from session_titler import clean_heuristic_title, update_session_title_async
import agent
import deep_agent

app = FastAPI(title="SydLiving AI API", version="0.2.0")

app.add_middleware(GZipMiddleware, minimum_size=1000)

allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:3000",
    "https://sydliving.com",
    "https://www.sydliving.com",
]
if allowed_origins_env:
    for o in allowed_origins_env.split(","):
        stripped = o.strip()
        if stripped and stripped not in origins:
            origins.append(stripped)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_origin_regex=r"https://.*\.a\.run\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths excluded from request logging (admin dashboard polling and health probes would skew stats).
_UNLOGGED_PREFIXES = ("/api/admin", "/api/health")

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    path = request.url.path
    if request.method == "OPTIONS" or not path.startswith("/api") or path.startswith(_UNLOGGED_PREFIXES):
        return await call_next(request)
    start = time.perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        latency_ms = (time.perf_counter() - start) * 1000
        route = request.scope.get("route")
        route_path = getattr(route, "path", None) or path  # template path, e.g. /api/properties/{property_id}
        user_id = peek_user_id(request.headers.get("authorization"))
        await run_in_threadpool(analytics.log_request, request.method, route_path, status, latency_ms, user_id)

@app.on_event("startup")
def _prune_analytics_logs():
    analytics.prune_logs()

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
    credential: str  # Google Identity Services ID token (JWT), verified server-side

def format_user_dict(d: dict) -> dict:
    """Format and deserialize database user row for User response model."""
    res = dict(d)
    if isinstance(res.get("lifestyle_vibes"), str):
        try:
            res["lifestyle_vibes"] = json.loads(res["lifestyle_vibes"])
        except Exception:
            res["lifestyle_vibes"] = []
    elif res.get("lifestyle_vibes") is None:
        res["lifestyle_vibes"] = []
        
    if isinstance(res.get("preferred_transit_modes"), str):
        try:
            res["preferred_transit_modes"] = json.loads(res["preferred_transit_modes"])
        except Exception:
            res["preferred_transit_modes"] = []
    elif res.get("preferred_transit_modes") is None:
        res["preferred_transit_modes"] = []
        
    res["has_pets"] = bool(res.get("has_pets", 0))
    res["needs_parking"] = bool(res.get("needs_parking", 0))
    if not res.get("workplace_hub"):
        res["workplace_hub"] = "Martin Place"
    if res.get("max_commute_mins") is None:
        res["max_commute_mins"] = 45
    if res.get("max_weekly_rent") is None:
        res["max_weekly_rent"] = 1000.0
    if res.get("min_bedrooms") is None:
        res["min_bedrooms"] = 1
    if not res.get("kai_verbosity"):
        res["kai_verbosity"] = "concise"
    res["is_admin"] = is_admin_email(res.get("email"))
    return res

@app.post("/api/auth/google")
def google_auth(payload: GoogleAuthPayload, db: sqlite3.Connection = Depends(get_db_connection)):
    """Verify a Google ID token server-side and issue a SydLiving session token.

    Identity is keyed on Google's stable `sub`. A pre-existing row with the same (now verified)
    email is linked on first sign-in so legacy history carries over.
    """
    claims = verify_google_credential(payload.credential)
    sub = claims["sub"]
    email = claims["email"].lower()
    name = claims.get("name") or email
    avatar = claims.get("picture") or f"https://ui-avatars.com/api/?name={name}&background=4285F4&color=fff&rounded=true"
    now = datetime.now().isoformat()

    cursor = db.cursor()
    row = cursor.execute("SELECT * FROM users WHERE google_sub = ?", (sub,)).fetchone()
    if not row:
        row = cursor.execute(
            "SELECT * FROM users WHERE lower(email) = ? AND google_sub IS NULL ORDER BY rowid LIMIT 1", (email,)
        ).fetchone()

    if row:
        user_id = row["id"]
        cursor.execute(
            "UPDATE users SET google_sub = ?, email = ?, username = ?, avatar_url = ?, auth_provider = 'google', "
            "last_login_at = ?, created_at = COALESCE(created_at, ?) WHERE id = ?",
            (sub, email, name, avatar, now, now, user_id),
        )
    else:
        user_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO users (id, username, email, avatar_url, auth_provider, google_sub, created_at, last_login_at) "
            "VALUES (?, ?, ?, ?, 'google', ?, ?, ?)",
            (user_id, name, email, avatar, sub, now, now),
        )
    db.commit()

    user_row = cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return {
        "token": create_session_token(user_id, email),
        "user": User(**format_user_dict(user_row)),
        "is_admin": is_admin_email(email),
    }

@app.get("/api/auth/me")
def auth_me(user_id: str = Depends(require_user), db: sqlite3.Connection = Depends(get_db_connection)):
    row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return {"user": User(**format_user_dict(row)), "is_admin": is_admin_email(row["email"])}

@app.get("/api/user/profile", response_model=User)
def get_user_profile(user_id: str = Depends(require_user), db: sqlite3.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**format_user_dict(row))

@app.put("/api/user/profile", response_model=User)
def update_user_profile(
    profile: UserProfileUpdate = Body(...),
    user_id: str = Depends(require_user),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    
    updates = []
    params = []
    if profile.workplace_hub is not None:
        updates.append("workplace_hub = ?")
        params.append(profile.workplace_hub)
    if profile.max_commute_mins is not None:
        updates.append("max_commute_mins = ?")
        params.append(profile.max_commute_mins)
    if profile.max_weekly_rent is not None:
        updates.append("max_weekly_rent = ?")
        params.append(profile.max_weekly_rent)
    if profile.min_bedrooms is not None:
        updates.append("min_bedrooms = ?")
        params.append(profile.min_bedrooms)
    if profile.has_pets is not None:
        updates.append("has_pets = ?")
        params.append(1 if profile.has_pets else 0)
    if profile.needs_parking is not None:
        updates.append("needs_parking = ?")
        params.append(1 if profile.needs_parking else 0)
    if profile.lifestyle_vibes is not None:
        updates.append("lifestyle_vibes = ?")
        params.append(json.dumps(profile.lifestyle_vibes))
    if profile.preferred_transit_modes is not None:
        updates.append("preferred_transit_modes = ?")
        params.append(json.dumps(profile.preferred_transit_modes))
    if profile.kai_verbosity is not None:
        updates.append("kai_verbosity = ?")
        params.append(profile.kai_verbosity)

    if updates:
        params.append(user_id)
        cursor.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        db.commit()

    return get_user_profile(user_id=user_id, db=db)

@app.post("/api/sync/listings", response_model=ListingSyncResponse)
def trigger_listing_sync(
    only_real: bool = Query(True, description="Whether to purge synthetic listings and keep only real listings"),
    admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    """Admin or Cloud Scheduler endpoint to trigger active Sydney listing synchronization."""
    secret = os.environ.get("ADMIN_SECRET_KEY")
    if secret and admin_key != secret:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid admin sync key")
    
    result = sync_active_listings(db=db, only_real=only_real)
    return ListingSyncResponse(**result)

def format_property_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    if isinstance(d.get("image_urls"), str):
        try:
            d["image_urls"] = json.loads(d["image_urls"])
        except Exception:
            d["image_urls"] = [d["photo_url"]] if d.get("photo_url") else []
    elif not d.get("image_urls"):
        d["image_urls"] = [d["photo_url"]] if d.get("photo_url") else []

    if isinstance(d.get("features_list"), str):
        try:
            d["features_list"] = json.loads(d["features_list"])
        except Exception:
            d["features_list"] = []
    elif not d.get("features_list"):
        d["features_list"] = []

    d["pet_friendly"] = bool(d.get("pet_friendly", 0))
    d["has_air_con"] = bool(d.get("has_air_con", 0))
    d["is_real_listing"] = bool(d.get("is_real_listing", 1))
    return d

@app.get("/api/properties", response_model=PropertySearchResponse)
def search_properties(
    suburbs: Optional[List[str]] = Query(None, description="List of suburbs to filter by"),
    property_ids: Optional[List[str]] = Query(None, description="List of property IDs to filter by"),
    max_rent: Optional[float] = Query(None, description="Maximum weekly rent in AUD"),
    min_bedrooms: Optional[int] = Query(None, description="Minimum number of bedrooms"),
    destination_hub: Optional[str] = Query(None, description="Destination hub for commute calculation"),
    max_commute_mins: Optional[int] = Query(None, description="Maximum commute time in minutes"),
    keyword: Optional[str] = Query(None, description="Keyword search in title"),
    property_type: Optional[str] = Query(None, description="Property type filter"),
    pet_friendly: Optional[bool] = Query(None, description="Filter for pet-friendly properties"),
    needs_parking: Optional[bool] = Query(None, description="Filter for properties with parking spaces"),
    has_air_con: Optional[bool] = Query(None, description="Filter for properties with air conditioning"),
    circle: Optional[str] = Query(None, description="Circle filter: lat,lng,radius_m"),
    polygon: Optional[str] = Query(None, description="Polygon filter: lat,lng;lat,lng..."),
    db: sqlite3.Connection = Depends(get_db_connection)
):
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

    if property_ids:
        placeholders = ','.join('?' * len(property_ids))
        query += f" AND p.id IN ({placeholders})"
        params.extend(property_ids)

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
    if pet_friendly is True:
        query += " AND p.pet_friendly = 1"
    if needs_parking is True:
        query += " AND p.parking_spaces >= 1"
    if has_air_con is True:
        query += " AND p.has_air_con = 1"

    if destination_hub:
        query += " ORDER BY cm.duration_minutes ASC, p.weekly_rent ASC"
    else:
        query += " ORDER BY p.weekly_rent ASC"
        
    cursor = db.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    results = [Property(**format_property_dict(row)) for row in rows]
    
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

class SavedPropertiesSyncPayload(BaseModel):
    property_ids: List[str] = []

@app.post("/api/properties/saved/sync", response_model=List[Property])
def sync_saved_properties(
    payload: SavedPropertiesSyncPayload,
    user_id: str = Depends(require_user),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    now = datetime.now().isoformat()
    cursor = db.cursor()
    for pid in payload.property_ids:
        try:
            cursor.execute("SELECT 1 FROM properties WHERE id = ?", (pid,))
            if cursor.fetchone():
                cursor.execute(
                    "INSERT INTO saved_properties (user_id, property_id, created_at) VALUES (?, ?, ?) "
                    "ON CONFLICT(user_id, property_id) DO NOTHING",
                    (user_id, pid, now)
                )
        except sqlite3.Error:
            pass

    # Clean up any orphaned saved_properties where property_id is not in properties
    try:
        cursor.execute("""
            DELETE FROM saved_properties 
            WHERE user_id = ? AND property_id NOT IN (SELECT id FROM properties)
        """, (user_id,))
    except sqlite3.Error:
        pass
    db.commit()

    cursor.execute('''
        SELECT p.* FROM properties p
        JOIN saved_properties sp ON p.id = sp.property_id
        WHERE sp.user_id = ?
    ''', (user_id,))
    rows = cursor.fetchall()
    return [Property(**format_property_dict(row)) for row in rows]

@app.get("/api/properties/saved")
def get_saved_properties(user_id: str = Depends(require_user), db: sqlite3.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    cursor.execute('''
        SELECT p.* FROM properties p
        JOIN saved_properties sp ON p.id = sp.property_id
        WHERE sp.user_id = ?
    ''', (user_id,))
    rows = cursor.fetchall()
    return [Property(**format_property_dict(row)) for row in rows]

@app.post("/api/properties/saved/{property_id}")
def save_property(property_id: str, user_id: str = Depends(require_user), db: sqlite3.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    cursor.execute("SELECT 1 FROM properties WHERE id = ?", (property_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Property not found")
    try:
        now = datetime.now().isoformat()
        cursor.execute(
            "INSERT INTO saved_properties (user_id, property_id, created_at) VALUES (?, ?, ?) "
            "ON CONFLICT(user_id, property_id) DO NOTHING",
            (user_id, property_id, now)
        )
        db.commit()
    except sqlite3.Error:
        pass
    return {"status": "ok"}

@app.delete("/api/properties/saved/{property_id}")
def unsave_property(property_id: str, user_id: str = Depends(require_user), db: sqlite3.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    cursor.execute("DELETE FROM saved_properties WHERE user_id = ? AND property_id = ?", (user_id, property_id))
    db.commit()
    return {"status": "ok"}

@app.get("/api/properties/{property_id}", response_model=Property)
def get_property_by_id(
    property_id: str,
    destination_hub: Optional[str] = Query(None, description="Optional destination hub for commute calculation"),
    db: sqlite3.Connection = Depends(get_db_connection)
):
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
            WHERE p.id = ?
        """
        hub_like = f"%{destination_hub}%"
        row = db.execute(query, (destination_hub, hub_like, property_id)).fetchone()
    else:
        query = "SELECT * FROM properties WHERE id = ?"
        row = db.execute(query, (property_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Property not found")

    return Property(**format_property_dict(row))

@app.get("/api/commute", response_model=CommuteResponse)
def get_commute(
    origin_suburb: str = Query(..., description="The origin suburb"),
    destination_cbd_hub: str = Query(..., description="The destination CBD hub"),
    db: sqlite3.Connection = Depends(get_db_connection)
):
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

@app.get("/api/places", response_model=PlaceResponse)
def get_places(
    suburb: str = Query(..., description="The suburb to search for places"),
    type: str = Query("cafe", description="Type of place (e.g., cafe, gym, transit_station)")
):
    places = fetch_google_places(suburb, type)
    return PlaceResponse(places=places)

@app.get("/api/chat/sessions", response_model=ChatSessionResponse)
def get_chat_sessions(user_id: str = Depends(require_user), db: sqlite3.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC", (user_id,))
    rows = cursor.fetchall()
    return ChatSessionResponse(sessions=[ChatSession(**dict(row)) for row in rows])

@app.get("/api/chat/sessions/{session_id}/messages", response_model=ChatMessageResponse)
def get_chat_messages(session_id: str, user_id: str = Depends(require_user), db: sqlite3.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    cursor.execute("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Session not found")
    
    cursor.execute("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
    rows = cursor.fetchall()
    return ChatMessageResponse(messages=[ChatMessage(**dict(row)) for row in rows])

@app.delete("/api/chat/sessions/{session_id}")
def delete_chat_session(session_id: str, user_id: str = Depends(require_user), db: sqlite3.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
    cursor.execute("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
    db.commit()
    return {"status": "deleted", "session_id": session_id}

@app.patch("/api/chat/sessions/{session_id}", response_model=ChatSession)
def update_chat_session(
    session_id: str,
    payload: ChatSessionUpdate,
    user_id: str = Depends(require_user),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    clean_title = payload.title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    cursor = db.cursor()
    cursor.execute("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Session not found")
    now = datetime.now().isoformat()
    cursor.execute("UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?", (clean_title, now, session_id, user_id))
    db.commit()
    cursor.execute("SELECT * FROM chat_sessions WHERE id = ?", (session_id,))
    row = cursor.fetchone()
    return ChatSession(**dict(row))

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest, 
    auth_user_id: Optional[str] = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    try:
        session_id = request.session_id
        cursor = db.cursor()
        now = datetime.now().isoformat()
        user_id = auth_user_id
        
        user_profile = None
        if user_id:
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            u_row = cursor.fetchone()
            if u_row:
                user_profile = format_user_dict(u_row)

            if not session_id:
                session_id = str(uuid.uuid4())
                title = clean_heuristic_title(request.message)
                cursor.execute(
                    "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (session_id, user_id, title, now, now)
                )
                asyncio.create_task(update_session_title_async(session_id, request.message, database.DB_PATH))
            
            if session_id:
                msg_id = str(uuid.uuid4())
                cursor.execute(
                    "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                    (msg_id, session_id, "user", request.message, now)
                )
                cursor.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, session_id))
                db.commit()

        start_time = time.perf_counter()
        result = await agent.process_chat(request.message, request.history, user_profile=user_profile)
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        
        usage = result.get("usage") or {}
        analytics.log_external_call(
            service="gemini",
            operation="process_chat",
            success=result.get("error") is None,
            latency_ms=elapsed_ms,
            tokens_in=usage.get("tokens_in"),
            tokens_out=usage.get("tokens_out"),
            error=result.get("error")
        )
        
        if session_id:
            msg_id = str(uuid.uuid4())
            now_resp = datetime.now().isoformat()
            cursor.execute(
                "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                (msg_id, session_id, "model", result["reply"], now_resp)
            )
            cursor.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now_resp, session_id))
            db.commit()

        actions = [AgentAction(**action) for action in result["actions"]]
        if session_id:
            actions.append(AgentAction(action_type="set_session", data={"session_id": session_id}))

        return ChatResponse(reply=result["reply"], actions=actions, agent_type="standard")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/deep", response_model=ChatResponse)
async def chat_deep_endpoint(
    request: ChatRequest, 
    auth_user_id: Optional[str] = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    try:
        session_id = request.session_id
        cursor = db.cursor()
        now = datetime.now().isoformat()
        user_id = auth_user_id
        
        user_profile = None
        if user_id:
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            u_row = cursor.fetchone()
            if u_row:
                user_profile = format_user_dict(u_row)

            if not session_id:
                session_id = str(uuid.uuid4())
                title = clean_heuristic_title(request.message)
                cursor.execute(
                    "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (session_id, user_id, title, now, now)
                )
                asyncio.create_task(update_session_title_async(session_id, request.message, database.DB_PATH))
            
            if session_id:
                msg_id = str(uuid.uuid4())
                cursor.execute(
                    "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                    (msg_id, session_id, "user", request.message, now)
                )
                cursor.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, session_id))
                db.commit()

        start_time = time.perf_counter()
        result = await deep_agent.process_deep_chat(request.message, request.history, user_profile=user_profile)
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        analytics.log_external_call(
            service="gemini_deep",
            operation="process_deep_chat",
            success=result.get("error") is None,
            latency_ms=elapsed_ms,
            error=result.get("error")
        )
        
        if session_id:
            msg_id = str(uuid.uuid4())
            now_resp = datetime.now().isoformat()
            cursor.execute(
                "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                (msg_id, session_id, "model", result["reply"], now_resp)
            )
            cursor.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now_resp, session_id))
            db.commit()

        actions = [AgentAction(**action) for action in result["actions"]]
        if session_id:
            actions.append(AgentAction(action_type="set_session", data={"session_id": session_id}))

        return ChatResponse(
            reply=result["reply"], 
            actions=actions, 
            latency_seconds=result.get("latency_seconds"),
            agent_type="deep_agent"
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/deep/stream")
async def chat_deep_stream_endpoint(
    request: ChatRequest,
    auth_user_id: Optional[str] = Depends(get_current_user)
):
    async def event_generator():
        session_id = request.session_id
        now = datetime.now().isoformat()
        user_profile = None
        user_id = auth_user_id
        
        # 1. If user is logged in, create or update session and save user message
        if user_id:
            try:
                with sqlite3.connect(database.DB_PATH) as conn:
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
                    u_row = cursor.fetchone()
                    if u_row:
                        user_profile = format_user_dict(u_row)

                    if not session_id:
                        session_id = str(uuid.uuid4())
                        title = clean_heuristic_title(request.message)
                        cursor.execute(
                            "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                            (session_id, user_id, title, now, now)
                        )
                        asyncio.create_task(update_session_title_async(session_id, request.message, database.DB_PATH))
                    
                    msg_id = str(uuid.uuid4())
                    cursor.execute(
                        "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                        (msg_id, session_id, "user", request.message, now)
                    )
                    cursor.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, session_id))
                    conn.commit()
            except Exception as db_err:
                print(f"[DeepStream] Error saving user message to DB: {db_err}")

        # Yield set_session action event immediately if session_id is available
        if session_id:
            set_session_action = {"action_type": "set_session", "data": {"session_id": session_id}}
            yield f"event: action\ndata: {json.dumps(set_session_action)}\n\n"

        # 2. Stream events from deep_agent
        accumulated_text = ""
        saved_model_message = False

        try:
            async for sse_chunk in deep_agent.stream_deep_chat(request.message, request.history, user_profile=user_profile):
                # If we encounter the "done" event, make sure set_session action is in its actions array
                if session_id and "event: done" in sse_chunk:
                    try:
                        lines = sse_chunk.split("\n")
                        data_line = next((l for l in lines if l.startswith("data: ")), None)
                        if data_line:
                            done_data = json.loads(data_line[6:])
                            actions = done_data.get("actions", [])
                            if not any(a.get("action_type") == "set_session" for a in actions):
                                actions.append({"action_type": "set_session", "data": {"session_id": session_id}})
                                done_data["actions"] = actions
                            if done_data.get("reply"):
                                accumulated_text = done_data["reply"]
                            sse_chunk = f"event: done\ndata: {json.dumps(done_data)}\n\n"

                            # Persist model reply immediately upon done
                            if user_id and accumulated_text:
                                try:
                                    with sqlite3.connect(database.DB_PATH) as conn:
                                        c = conn.cursor()
                                        now_resp = datetime.now().isoformat()
                                        msg_id = str(uuid.uuid4())
                                        c.execute(
                                            "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                                            (msg_id, session_id, "model", accumulated_text, now_resp)
                                        )
                                        c.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now_resp, session_id))
                                        conn.commit()
                                        saved_model_message = True
                                except Exception as save_err:
                                    print(f"[DeepStream] Error saving model reply on done: {save_err}")
                    except Exception as parse_e:
                        print(f"[DeepStream] Error augmenting done event: {parse_e}")

                if "event: chunk" in sse_chunk:
                    for line in sse_chunk.split("\n"):
                        if line.startswith("data: "):
                            try:
                                chunk_data = json.loads(line[6:])
                                if "text" in chunk_data:
                                    accumulated_text += chunk_data["text"]
                            except Exception:
                                pass

                yield sse_chunk
        finally:
            # 3. On completion (or interruption), save model reply to DB if not already saved
            if user_id and session_id and accumulated_text and not saved_model_message:
                try:
                    with sqlite3.connect(database.DB_PATH) as conn:
                        cursor = conn.cursor()
                        now_resp = datetime.now().isoformat()
                        msg_id = str(uuid.uuid4())
                        cursor.execute(
                            "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                            (msg_id, session_id, "model", accumulated_text, now_resp)
                        )
                        cursor.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now_resp, session_id))
                        conn.commit()
                except Exception as db_err:
                    print(f"[DeepStream] Error saving model message to DB: {db_err}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )

# ---------------------------------------------------------------------------
# Admin Insights API (read-only, guarded by require_admin)
# ---------------------------------------------------------------------------

@app.get("/api/admin/overview")
def admin_overview(
    range: str = Query("7d", pattern="^(24h|7d|30d|all)$"),
    include_admins: bool = Query(False),
    admin: dict = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    return analytics.overview(db, range_key=range, include_admins=include_admins)

@app.get("/api/admin/users")
def admin_users_list(
    include_admins: bool = Query(False),
    admin: dict = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    return analytics.list_users(db, include_admins=include_admins)

@app.get("/api/admin/users/{user_id}")
def admin_user_detail(
    user_id: str,
    admin: dict = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    detail = analytics.user_detail(db, user_id=user_id)
    if not detail:
        raise HTTPException(status_code=404, detail="User not found")
    return detail

@app.get("/api/admin/sessions/{session_id}/messages")
@app.get("/api/admin/users/{user_id}/sessions/{session_id}/messages")
def admin_session_transcript(
    session_id: str,
    user_id: Optional[str] = None,
    admin: dict = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    transcript = analytics.session_transcript(db, session_id=session_id, user_id=user_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Session or transcript not found")
    return transcript

@app.get("/api/admin/chats")
def admin_chats_analytics(
    range: str = Query("7d", pattern="^(24h|7d|30d|all)$"),
    include_admins: bool = Query(False),
    admin: dict = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    return analytics.chats(db, range_key=range, include_admins=include_admins)

@app.get("/api/admin/saved")
def admin_saved_analytics(
    range: str = Query("7d", pattern="^(24h|7d|30d|all)$"),
    include_admins: bool = Query(False),
    admin: dict = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    return analytics.saved(db, range_key=range, include_admins=include_admins)

@app.get("/api/admin/health")
def admin_health_analytics(
    range: str = Query("7d", pattern="^(24h|7d|30d|all)$"),
    include_admins: bool = Query(False),
    admin: dict = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    return analytics.health(db, range_key=range, include_admins=include_admins)



