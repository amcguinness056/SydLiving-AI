import sqlite3
from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from database import get_db_connection
from models import PropertySearchResponse, Property, CommuteResponse, CommuteMatrix

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

