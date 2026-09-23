import os
import sqlite3
import json
from typing import Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

from database import get_db_connection
from integrations import fetch_domain_properties, fetch_google_commute, fetch_google_places

def query_properties_tool(suburb: str, max_rent: float, min_bedrooms: int) -> str:
    """Queries real-world Domain API and local database for properties matching the criteria.
    Args:
        suburb: A specific suburb to filter by, or empty string "" if none.
        max_rent: Maximum weekly rent in AUD, or 99999.0 if no maximum.
        min_bedrooms: Minimum number of bedrooms, or 0 if no minimum.
    """
    try:
        results = fetch_domain_properties(suburb, max_rent, min_bedrooms)
        return json.dumps({"properties": results, "count": len(results)})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return json.dumps({"error": str(e)})

def get_commute_tool(origin_suburb: str, destination_cbd_hub: str) -> str:
    """Looks up the door-to-door commute time and transit mode between an origin suburb and a destination hub.
    Args:
        origin_suburb: The starting suburb (e.g. 'Bondi Beach', 'Coogee', 'Manly', 'Crows Nest', 'Newtown').
        destination_cbd_hub: The destination hub (e.g. 'Barangaroo', 'Martin Place', 'Central', 'Victoria Cross (North Sydney)', 'Macquarie Park', 'Parramatta').
    """
    try:
        results = fetch_google_commute(origin_suburb, destination_cbd_hub)
        return json.dumps({"commutes": results})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return json.dumps({"error": str(e)})

def get_places_tool(suburb: str, place_type: str) -> str:
    """Looks up real-world Google Places (gyms, cafes, transit) in a suburb.
    Args:
        suburb: The suburb (e.g. 'Bondi').
        place_type: The type of place (e.g. 'cafe', 'gym', 'transit_station', 'supermarket').
    """
    try:
        results = fetch_google_places(suburb, place_type)
        return json.dumps({"places": results})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return json.dumps({"error": str(e)})

def filter_by_commute_reach_tool(destination_hub: str, max_commute_minutes: int, max_rent: float, min_bedrooms: int) -> str:
    """Finds properties and suburbs within a specified transit commute travel time (isochrone reach) to a destination hub.
    Args:
        destination_hub: Destination employment/CBD hub (e.g. 'Barangaroo', 'Martin Place', 'Central', 'Victoria Cross (North Sydney)', 'Macquarie Park', 'Parramatta').
        max_commute_minutes: Maximum travel time in minutes (e.g. 15, 25, 30, 45).
        max_rent: Maximum weekly rent in AUD, or 99999.0 if no maximum.
        min_bedrooms: Minimum number of bedrooms, or 0 if no minimum.
    """
    from database import DB_PATH
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.row_factory = sqlite3.Row
    try:
        query = """
            SELECT p.id, p.title, p.suburb, p.weekly_rent, p.bedrooms, p.bathrooms,
                   cm.duration_minutes, cm.transit_mode, cm.transfers, cm.estimated_opal_fare
            FROM properties p
            JOIN commute_matrix cm ON p.suburb = cm.origin_suburb
            WHERE (cm.destination_cbd_hub = ? OR cm.destination_cbd_hub LIKE ?)
              AND cm.duration_minutes <= ?
        """
        params = [destination_hub, f"%{destination_hub}%", max_commute_minutes]
        
        if max_rent < 99999.0:
            query += " AND p.weekly_rent <= ?"
            params.append(max_rent)
        if min_bedrooms > 0:
            query += " AND p.bedrooms >= ?"
            params.append(min_bedrooms)
            
        query += " ORDER BY cm.duration_minutes ASC, p.weekly_rent ASC"
        
        cursor = db.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        results = [dict(row) for row in rows]
        return json.dumps({"matching_properties": results, "total_found": len(results), "hub": destination_hub, "max_minutes": max_commute_minutes})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return json.dumps({"error": str(e)})
    finally:
        db.close()

async def process_chat(message: str, history: list) -> dict:
    """Processes a chat message using Gemini and native tool calling."""
    import traceback
    try:
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if not gemini_key:
            return {
                "reply": "Error: GEMINI_API_KEY is not set in the backend environment. Please configure it to enable the AI Agent.",
                "actions": []
            }
            
        client = genai.Client(api_key=gemini_key)
        
        contents = []
        for h in history:
            contents.append(
                types.Content(role=h["role"], parts=[types.Part.from_text(text=h["parts"])])
            )
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=message)])
        )
        
        system_instruction = """You are SydLiving AI, Sydney's intelligent relocation and housing discovery assistant.
You have access to door-to-door transit commute matrices across Greater Sydney (Sydney Metro M1, Sydney Trains, Sydney Ferries, Light Rail, and Express Buses) and Google Places / Domain APIs.
When users ask for housing near specific hubs (Barangaroo, Martin Place, Central, Victoria Cross/North Sydney, Macquarie Park, Parramatta), within a certain commute time, or with budget/bedroom preferences, ALWAYS use the relevant tools to look up real properties and commute times.
Give concise, reassuring, and precise answers highlighting commute times, transit lines, and rental prices."""
        
        tools = [query_properties_tool, get_commute_tool, get_places_tool, filter_by_commute_reach_tool]
        
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=tools,
            temperature=0.3,
        )
        
        model_name = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
        chat = client.chats.create(model=model_name, config=config)
        
        if history:
            chat._history = contents[:-1]
            
        try:
            response = chat.send_message(message)
        except Exception as api_err:
            if "503" in str(api_err) or "UNAVAILABLE" in str(api_err):
                model_name = "gemini-3.5-flash"
                chat = client.chats.create(model=model_name, config=config)
                if history:
                    chat._history = contents[:-1]
                response = chat.send_message(message)
            else:
                raise api_err
        
        actions = []
        if chat.get_history():
            for content in chat.get_history():
                if content.role == "model" and content.parts:
                    for part in content.parts:
                        if hasattr(part, 'function_call') and part.function_call:
                            fc = part.function_call
                            args_dict = {}
                            if hasattr(fc.args, 'items'):
                                args_dict = {k: v for k, v in fc.args.items()}
                            elif isinstance(fc.args, dict):
                                args_dict = fc.args
                            else:
                                for k in dir(fc.args):
                                    if not k.startswith('_'):
                                        args_dict[k] = getattr(fc.args, k)
                            
                            action_type = None
                            if fc.name == "query_properties_tool":
                                action_type = "update_properties"
                            elif fc.name == "get_commute_tool":
                                action_type = "update_commute"
                            elif fc.name == "get_places_tool":
                                action_type = "update_places"
                            elif fc.name == "filter_by_commute_reach_tool":
                                action_type = "update_commute_filters"
                                
                            if action_type:
                                new_action = {
                                    "action_type": action_type,
                                    "data": args_dict
                                }
                                if new_action not in actions:
                                    actions.append(new_action)

        reply_text = ""
        if response.text:
            reply_text = response.text
        elif hasattr(response, 'candidates') and response.candidates:
            for cand in response.candidates:
                if hasattr(cand, 'content') and cand.content and hasattr(cand.content, 'parts'):
                    for pt in cand.content.parts:
                        if hasattr(pt, 'text') and pt.text:
                            reply_text += pt.text
        
        if not reply_text:
            reply_text = "I've processed your request and updated the map and property listings accordingly!"

        return {
            "reply": reply_text,
            "actions": actions
        }
    except Exception as e:
        print(f"[Agent] ERROR IN process_chat: {str(e)}")
        traceback.print_exc()
        
        error_msg = str(e)
        if "503" in error_msg or "UNAVAILABLE" in error_msg:
            return {
                "reply": "I'm sorry, but my AI brain is currently experiencing high demand. Please try again in a few moments!",
                "actions": []
            }
        elif "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            return {
                "reply": "I'm sorry, but we've hit our API rate limits. Please try again in a minute.",
                "actions": []
            }
            
        return {
            "reply": f"Oops! I encountered an internal error: {type(e).__name__}. Please try again.",
            "actions": []
        }
