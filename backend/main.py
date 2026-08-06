import sqlite3
import traceback
from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from database import get_db_connection
from models import PropertySearchResponse, Property, CommuteResponse, CommuteMatrix, ChatRequest, ChatResponse, AgentAction, PlaceResponse
from integrations import fetch_domain_properties, fetch_google_commute, fetch_google_places
import agent

app = FastAPI(title="SydLiving AI API", version="0.1.0")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
        # Return empty list rather than 404 to gracefully handle no data
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

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        print(f"--- Chat Request ---")
        print(f"Message: {request.message}")
        print(f"History length: {len(request.history)}")
        
        # We need to await the process_chat function
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
