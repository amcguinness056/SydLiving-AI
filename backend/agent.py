import os
import sqlite3
import json
from typing import Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

from database import get_db_connection

def query_properties_tool(suburb: str, max_rent: float, min_bedrooms: int) -> str:
    """Queries the local database for properties matching the criteria.
    Args:
        suburb: A specific suburb to filter by, or empty string "" if none.
        max_rent: Maximum weekly rent in AUD, or 99999.0 if no maximum.
        min_bedrooms: Minimum number of bedrooms, or 0 if no minimum.
    """
    db = next(get_db_connection())
    try:
        query = "SELECT id, title, suburb, weekly_rent, bedrooms, bathrooms FROM properties WHERE 1=1"
        params = []
        
        if suburb and suburb != "":
            query += " AND suburb = ?"
            params.append(suburb)
        if max_rent < 99999.0:
            query += " AND weekly_rent <= ?"
            params.append(max_rent)
        if min_bedrooms > 0:
            query += " AND bedrooms >= ?"
            params.append(min_bedrooms)
            
        cursor = db.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        results = [dict(row) for row in rows]
        # Return structured JSON for the agent
        return json.dumps({"properties": results})
    finally:
        db.close()

def get_commute_tool(origin_suburb: str, destination_cbd_hub: str) -> str:
    """Looks up the commute time between an origin suburb and a CBD hub.
    Args:
        origin_suburb: The starting suburb (e.g. 'Coogee').
        destination_cbd_hub: The destination hub (e.g. 'Barangaroo').
    """
    db = next(get_db_connection())
    try:
        cursor = db.cursor()
        cursor.execute('''
            SELECT * FROM commute_matrix 
            WHERE origin_suburb = ? AND destination_cbd_hub = ?
        ''', (origin_suburb, destination_cbd_hub))
        
        rows = cursor.fetchall()
        results = [dict(row) for row in rows]
        return json.dumps({"commutes": results})
    finally:
        db.close()


async def process_chat(message: str, history: list) -> dict:
    """Processes a chat message using Gemini Pro and native tool calling."""
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {
            "reply": "Error: GEMINI_API_KEY is not set in the backend environment. Please configure it to enable the AI Agent.",
            "actions": []
        }
        
    client = genai.Client(api_key=api_key)
    
    # Simple history formatting
    # Note: For production, map history dicts to types.Content properly
    contents = []
    for h in history:
        contents.append(
            types.Content(role=h["role"], parts=[types.Part.from_text(h["parts"])])
        )
    contents.append(
        types.Content(role="user", parts=[types.Part.from_text(message)])
    )
    
    system_instruction = "You are SydLiving AI, an expert relocation assistant for Sydney. Use the provided tools to lookup real property and commute data when asked. Respond in a friendly, concise manner."
    
    tools = [query_properties_tool, get_commute_tool]
    
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        tools=tools,
        temperature=0.3,
    )
    
    # We use a chat session to automatically handle the multi-turn tool calling
    chat = client.chats.create(model="gemini-2.5-pro", config=config)
    
    # Pre-load history if the SDK supports it (workaround for basic chat)
    if history:
        chat._history = contents[:-1]
        
    response = chat.send_message(message)
    
    actions = []
    
    # Check if the model made a function call to determine if we should trigger UI updates
    # The new SDK automatically resolves the function calls during chat.send_message
    # We can inspect the chat history to see what tools were called and what they returned
    if chat.get_history():
        for content in chat.get_history()[-2:]:
            if content.role == "model" and content.parts:
                for part in content.parts:
                    if part.function_call:
                        fc = part.function_call
                        if fc.name == "query_properties_tool":
                            # Dispatch an action to update the UI
                            args = {k: v for k, v in fc.args.items()}
                            actions.append({
                                "action_type": "update_properties",
                                "data": args
                            })
                        elif fc.name == "get_commute_tool":
                            args = {k: v for k, v in fc.args.items()}
                            actions.append({
                                "action_type": "update_commute",
                                "data": args
                            })

    return {
        "reply": response.text,
        "actions": actions
    }
