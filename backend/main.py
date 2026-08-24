import sqlite3
import traceback
import uuid
import os
from dotenv import load_dotenv
load_dotenv()

from datetime import datetime
from fastapi import FastAPI, Depends, Query, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel

from database import get_db_connection
from models import (PropertySearchResponse, Property, CommuteResponse, CommuteMatrix, 
                    ChatRequest, ChatResponse, AgentAction, User, ChatSession, 
                    ChatMessage, ChatSessionResponse, ChatMessageResponse, PlaceResponse)
from integrations import fetch_domain_properties, fetch_google_commute, fetch_google_places
import agent

app = FastAPI(title="SydLiving AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
    # Check if user with this email or username already exists
    if payload.email:
        cursor.execute("SELECT * FROM users WHERE email = ?", (payload.email,))
        row = cursor.fetchone()
        if row:
            # Update avatar/name if changed
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
    keyword: Optional[str] = Query(None, description="Keyword search in title"),
    property_type: Optional[str] = Query(None, description="Property type filter"),
    circle: Optional[str] = Query(None, description="Circle filter: lat,lng,radius_m"),
    polygon: Optional[str] = Query(None, description="Polygon filter: lat,lng;lat,lng..."),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    query = "SELECT * FROM properties WHERE 1=1"
    params = []
    if suburbs:
        placeholders = ','.join('?' * len(suburbs))
        query += f" AND suburb IN ({placeholders})"
        params.extend(suburbs)
    if max_rent is not None:
        query += " AND weekly_rent <= ?"
        params.append(max_rent)
    if min_bedrooms is not None:
        query += " AND bedrooms >= ?"
        params.append(min_bedrooms)

    if keyword:
        query += " AND title LIKE ?"
        params.append(f"%{keyword}%")
        
    if property_type:
        query += " AND title LIKE ?"
        params.append(f"%{property_type}%")
        
    cursor = db.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    results = [Property(**dict(row)) for row in rows]
    
    if circle:
        try:
            clat, clng, cradius = map(float, circle.split(','))
            from math import radians, sin, cos, sqrt, atan2
            def calc_distance(lat1, lon1, lat2, lon2):
                R = 6371000 # meters
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
    cursor = db.cursor()
    cursor.execute('''
        SELECT * FROM commute_matrix 
        WHERE origin_suburb = ? AND destination_cbd_hub = ?
    ''', (origin_suburb, destination_cbd_hub))
    
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
        session_id = request.session_id
        cursor = db.cursor()
        now = datetime.now().isoformat()
        
        if request.user_id:
            if not session_id:
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

        result = await agent.process_chat(request.message, request.history)
        
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

        return ChatResponse(reply=result["reply"], actions=actions)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
