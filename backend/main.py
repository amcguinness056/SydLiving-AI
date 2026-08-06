import sqlite3
import traceback
import uuid
from datetime import datetime
from fastapi import FastAPI, Depends, Query, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from database import get_db_connection
from models import (PropertySearchResponse, Property, CommuteResponse, CommuteMatrix, 
                    ChatRequest, ChatResponse, AgentAction, User, ChatSession, 
                    ChatMessage, ChatSessionResponse, ChatMessageResponse)
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

@app.get("/api/properties", response_model=PropertySearchResponse)
def search_properties(
    suburbs: Optional[List[str]] = Query(None, description="List of suburbs to filter by"),
    max_rent: Optional[float] = Query(None, description="Maximum weekly rent in AUD"),
    min_bedrooms: Optional[int] = Query(None, description="Minimum number of bedrooms"),
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
        
    cursor = db.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    results = [Property(**dict(row)) for row in rows]
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
