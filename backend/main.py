import sqlite3
import traceback
from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from database import get_db_connection
from models import (
    PropertySearchResponse, Property, CommuteResponse, CommuteMatrix, 
    ChatRequest, ChatResponse, AgentAction, HubsResponse, DestinationHub,
    IsochroneResponse, IsochroneSuburb
)
import agent

app = FastAPI(title="SydLiving AI API", version="0.2.0")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    
    # Find hub info
    cursor.execute(
        "SELECT * FROM destination_hubs WHERE name = ? OR id = ? LIMIT 1", 
        (destination_hub, destination_hub.lower().replace(" ", "_"))
    )
    hub_row = cursor.fetchone()
    if not hub_row:
        # Fallback to fuzzy search or first hub
        cursor.execute("SELECT * FROM destination_hubs WHERE name LIKE ? LIMIT 1", (f"%{destination_hub}%",))
        hub_row = cursor.fetchone()
    
    if not hub_row:
        # Default to Central
        cursor.execute("SELECT * FROM destination_hubs WHERE id = 'central' LIMIT 1")
        hub_row = cursor.fetchone()

    hub = DestinationHub(**dict(hub_row))
    
    # Find all suburbs within reach of this hub
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

@app.get("/api/properties", response_model=PropertySearchResponse)
def search_properties(
    suburbs: Optional[List[str]] = Query(None, description="List of suburbs to filter by"),
    max_rent: Optional[float] = Query(None, description="Maximum weekly rent in AUD"),
    min_bedrooms: Optional[int] = Query(None, description="Minimum number of bedrooms"),
    destination_hub: Optional[str] = Query(None, description="Destination hub for commute calculation"),
    max_commute_mins: Optional[int] = Query(None, description="Maximum commute time in minutes"),
    db: sqlite3.Connection = Depends(get_db_connection)
):
    params = []
    
    if destination_hub:
        # Join with commute_matrix to get accurate commute details & filter
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

    if destination_hub:
        query += " ORDER BY cm.duration_minutes ASC, p.weekly_rent ASC"
    else:
        query += " ORDER BY p.weekly_rent ASC"
        
    cursor = db.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    results = [Property(**dict(row)) for row in rows]
    return PropertySearchResponse(results=results, total=len(results))

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

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        print(f"--- Chat Request ---")
        print(f"Message: {request.message}")
        print(f"History length: {len(request.history)}")
        
        result = await agent.process_chat(request.message, request.history)
        
        print(f"--- Chat Response ---")
        print(f"Reply: {result['reply']}")
        print(f"Actions: {result['actions']}")
        
        return ChatResponse(
            reply=result["reply"],
            actions=[AgentAction(**action) for action in result["actions"]]
        )
    except Exception as e:
        print("!!! ERROR IN /api/chat !!!")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

