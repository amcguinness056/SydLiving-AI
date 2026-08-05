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
    import traceback
    try:
        print(f"[Agent] Starting process_chat with model gemini-pro-latest")
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            print("[Agent] Error: GEMINI_API_KEY not found")
            return {
                "reply": "Error: GEMINI_API_KEY is not set in the backend environment. Please configure it to enable the AI Agent.",
                "actions": []
            }
            
        print("[Agent] Initializing client")
        client = genai.Client(api_key=api_key)
        
        # Simple history formatting
        # Note: For production, map history dicts to types.Content properly
        contents = []
        for h in history:
            contents.append(
                types.Content(role=h["role"], parts=[types.Part.from_text(text=h["parts"])])
            )
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=message)])
        )
        
        system_instruction = "You are SydLiving AI, an expert relocation assistant for Sydney. Use the provided tools to lookup real property and commute data when asked. Respond in a friendly, concise manner."
        
        tools = [query_properties_tool, get_commute_tool]
        
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=tools,
            temperature=0.3,
        )
        
        print(f"[Agent] Creating chat session")
        # We use a chat session to automatically handle the multi-turn tool calling
        chat = client.chats.create(model="gemini-3.5-flash", config=config)
        
        # Pre-load history if the SDK supports it (workaround for basic chat)
        if history:
            chat._history = contents[:-1]
            
        print(f"[Agent] Sending message to model: {message}")
        response = chat.send_message(message)
        print(f"[Agent] Received response from model")
        
        # Check if the model made a function call to determine if we should trigger UI updates
        # The new SDK automatically resolves the function calls during chat.send_message
        # We can inspect the new chat history to see what tools were called
        actions = []
        if chat.get_history():
            # Scan history for function calls, starting from the end
            # We want to find function calls made in the current turn
            for content in chat.get_history():
                if content.role == "model" and content.parts:
                    for part in content.parts:
                        # In the new SDK, part.function_call might be an object
                        if hasattr(part, 'function_call') and part.function_call:
                            fc = part.function_call
                            print(f"[Agent] Tool call detected: {fc.name}")
                            
                            # The args might be a dict directly or an object with an items() method or fields
                            args_dict = {}
                            if hasattr(fc.args, 'items'):
                                args_dict = {k: v for k, v in fc.args.items()}
                            elif isinstance(fc.args, dict):
                                args_dict = fc.args
                            else:
                                # Sometimes it's an object with attributes
                                for k in dir(fc.args):
                                    if not k.startswith('_'):
                                        args_dict[k] = getattr(fc.args, k)
                            
                            # Deduplicate actions
                            action_type = None
                            if fc.name == "query_properties_tool":
                                action_type = "update_properties"
                            elif fc.name == "get_commute_tool":
                                action_type = "update_commute"
                                
                            if action_type:
                                new_action = {
                                    "action_type": action_type,
                                    "data": args_dict
                                }
                                if new_action not in actions:
                                    actions.append(new_action)

        return {
            "reply": response.text,
            "actions": actions
        }
    except Exception as e:
        print(f"[Agent] ERROR IN process_chat: {str(e)}")
        traceback.print_exc()
        
        # Check if it's a 503 or 429
        error_msg = str(e)
        if "503" in error_msg or "UNAVAILABLE" in error_msg:
            return {
                "reply": "I'm sorry, but my AI brain is currently experiencing very high demand and couldn't process that request right now. Please try again in a few moments!",
                "actions": []
            }
        elif "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            return {
                "reply": "I'm sorry, but we've hit our API rate limits. Please try again in a minute.",
                "actions": []
            }
            
        # For all other errors, return a generic message
        return {
            "reply": f"Oops! I encountered an internal error while processing that: {type(e).__name__}. Please try again.",
            "actions": []
        }
