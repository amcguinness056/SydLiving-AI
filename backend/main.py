import sqlite3
import traceback
import uuid
import os
from dotenv import load_dotenv
load_dotenv()

from datetime import datetime
from fastapi import FastAPI, Depends, Query, HTTPException, Header
from starlette.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel

import json
import database
from database import get_db_connection
from models import (
    PropertySearchResponse, Property, CommuteResponse, CommuteMatrix, 
    ChatRequest, ChatResponse, AgentAction, HubsResponse, DestinationHub,
    IsochroneResponse, IsochroneSuburb, User, ChatSession, 
    ChatMessage, ChatSessionResponse, ChatMessageResponse, PlaceResponse
)
from integrations import fetch_domain_properties, fetch_google_commute, fetch_google_places
import agent
import deep_agent

app = FastAPI(title="SydLiving AI API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://localhost:3000"],
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

    return dict(row)

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

@app.delete("/api/chat/sessions/{session_id}")
def delete_chat_session(session_id: str, user_id: str = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db_connection)):
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    cursor = db.cursor()
    cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
    cursor.execute("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
    db.commit()
    return {"status": "deleted", "session_id": session_id}

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

        return ChatResponse(reply=result["reply"], actions=actions, agent_type="standard")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/deep", response_model=ChatResponse)
async def chat_deep_endpoint(request: ChatRequest, db: sqlite3.Connection = Depends(get_db_connection)):
    try:
        session_id = request.session_id
        cursor = db.cursor()
        now = datetime.now().isoformat()
        
        if request.user_id:
            if not session_id:
                session_id = str(uuid.uuid4())
                title = f"[Deep] {request.message[:25]}..." if len(request.message) > 25 else f"[Deep] {request.message}"
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

        result = await deep_agent.process_deep_chat(request.message, request.history)
        
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
async def chat_deep_stream_endpoint(request: ChatRequest):
    async def event_generator():
        session_id = request.session_id
        now = datetime.now().isoformat()
        
        # 1. If user is logged in, create or update session and save user message
        if request.user_id:
            try:
                with sqlite3.connect(database.DB_PATH) as conn:
                    cursor = conn.cursor()
                    if not session_id:
                        session_id = str(uuid.uuid4())
                        title = f"[Deep] {request.message[:25]}..." if len(request.message) > 25 else f"[Deep] {request.message}"
                        cursor.execute(
                            "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                            (session_id, request.user_id, title, now, now)
                        )
                    
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

        try:
            async for sse_chunk in deep_agent.stream_deep_chat(request.message, request.history):
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
            # 3. On completion (or interruption), save model reply to DB if user is logged in
            if request.user_id and session_id and accumulated_text:
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


