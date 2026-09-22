import os
import re
import json
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

from domain_client import domain_client
from tfnsw_client import tfnsw_client, SYDNEY_HUBS, SUBURB_STOPS
from semantic_search import semantic_engine
from session_store import session_store
from tradeoffs import compute_tradeoffs
from integrations import fetch_domain_properties, fetch_google_commute, fetch_google_places
import sqlite3

def query_properties_tool(suburb: str, max_rent: float, min_bedrooms: int) -> str:
    """Queries rental properties matching the criteria using Domain API and local database.
    Args:
        suburb: A specific suburb to filter by, or empty string "" if none.
        max_rent: Maximum weekly rent in AUD, or 99999.0 if no maximum.
        min_bedrooms: Minimum number of bedrooms, or 0 if no minimum.
    """
    try:
        sub = suburb if suburb and suburb.strip() != "" else None
        results = domain_client.search_listings(suburb=sub, max_rent=max_rent, min_bedrooms=min_bedrooms)
        summaries = [
            {
                "id": p["id"],
                "title": p["title"],
                "suburb": p["suburb"],
                "weekly_rent": p["weekly_rent"],
                "bedrooms": p["bedrooms"],
                "bathrooms": p["bathrooms"],
                "distance_to_beach_km": p.get("distance_to_beach_km")
            }
            for p in results[:10]
        ]
        return json.dumps({"properties": summaries, "count": len(summaries)})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return json.dumps({"error": str(e)})

def get_commute_tool(origin_suburb: str, destination_cbd_hub: str) -> str:
    """Looks up door-to-door commute time and transit mode between origin and destination using TfNSW Trip Planner.
    Args:
        origin_suburb: The starting suburb (e.g. 'Bondi Beach', 'Coogee', 'Manly', 'Crows Nest', 'Newtown').
        destination_cbd_hub: The destination hub (e.g. 'Barangaroo', 'Martin Place', 'Central', 'Victoria Cross', 'Parramatta').
    """
    try:
        trip = tfnsw_client.trip_planner(origin_suburb, destination_cbd_hub)
        if not trip:
            return json.dumps({"commutes": []})
        return json.dumps({"commutes": [trip]})
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
        destination_hub: Destination employment/CBD hub (e.g. 'Barangaroo', 'Martin Place', 'Central', 'Victoria Cross', 'Parramatta').
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
                   cm.duration_minutes, cm.transit_mode, cm.transfers
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
        return json.dumps({"error": str(e)})
    finally:
        db.close()

def _extract_constraints(message: str) -> Dict[str, Any]:
    """Extracts rent, bedroom, hub, suburb, and vibe constraints from natural language."""
    constraints: Dict[str, Any] = {}
    
    # Rent extraction ($750, 750/week, 800 pw)
    rent_match = re.search(r'\$?(\d{3,4})\s*(?:pw|/wk|/week|per week|dollars)?', message, re.IGNORECASE)
    if rent_match:
        val = float(rent_match.group(1))
        if 200 <= val <= 5000:
            constraints["max_rent"] = val

    # Bedroom extraction (2 bed, 2 beds, 3 bedrooms, 1br)
    bed_match = re.search(r'(\d+)\s*(?:bed|bedroom|br)s?\b', message, re.IGNORECASE)
    if bed_match:
        constraints["min_bedrooms"] = int(bed_match.group(1))

    # CBD hub detection
    for hub in SYDNEY_HUBS.keys():
        if hub.lower() in message.lower():
            constraints["preferred_cbd_hub"] = hub
            break

    # Suburb detection
    found_suburbs = []
    for sub in SUBURB_STOPS.keys():
        if sub.lower() in message.lower():
            found_suburbs.append(sub)
    if found_suburbs:
        constraints["suburbs"] = found_suburbs

    # Vibe cues
    vibe_words = ["leafy", "quiet", "coffee", "beach", "beachside", "coastal", "nightlife", "hipster", "peaceful", "scenic", "vibrant", "parks", "bars"]
    matched_vibes = [w for w in vibe_words if w in message.lower()]
    if matched_vibes:
        constraints["vibe_query"] = " ".join(matched_vibes)

    return constraints

async def process_chat(message: str, history: list, session_id: str = "default-session") -> dict:
    """Processes a chat message using Gemini, persists session preferences, and returns 2-3 trade-offs."""
    import traceback
    try:
        # Extract new constraints from current message and update session store
        extracted = _extract_constraints(message)
        pref = session_store.update_preferences(
            session_id=session_id,
            max_rent=extracted.get("max_rent"),
            min_bedrooms=extracted.get("min_bedrooms"),
            suburbs=extracted.get("suburbs"),
            preferred_cbd_hub=extracted.get("preferred_cbd_hub"),
            vibe_query=extracted.get("vibe_query")
        )

        # Retrieve relevant candidate listings using combined session context
        suburb_filter = pref.target_suburbs[0] if pref.target_suburbs else None
        candidates = domain_client.search_listings(
            suburb=suburb_filter,
            max_rent=pref.max_rent,
            min_bedrooms=pref.min_bedrooms
        )

        # Compute 2-3 labelled trade-off options
        target_hub = pref.preferred_cbd_hub or "Martin Place"
        tradeoffs = compute_tradeoffs(
            properties=candidates,
            destination_hub=target_hub,
            vibe_query=pref.vibe_query or message
        )

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            if message.lower().strip() in ["hello", "hi", "hey"]:
                return {
                    "reply": "Error: GEMINI_API_KEY is not set in the backend environment. Please configure it to enable the AI Agent.",
                    "actions": [],
                    "tradeoffs": [],
                    "session_preferences": pref.model_dump()
                }

            # High quality conversational fallback synthesising the trade-offs
            options_text = ""
            for opt in tradeoffs:
                options_text += f"\n- **{opt.label}** ({opt.property.suburb} - ${int(opt.property.weekly_rent)}/wk, {opt.commute_minutes} mins via {opt.transit_mode}): {opt.reasoning}"

            pref_summary = []
            if pref.max_rent:
                pref_summary.append(f"Max Rent: ${int(pref.max_rent)}/wk")
            if pref.min_bedrooms:
                pref_summary.append(f"Min Beds: {pref.min_bedrooms}")
            if pref.preferred_cbd_hub:
                pref_summary.append(f"Hub: {pref.preferred_cbd_hub}")
            if pref.vibe_query:
                pref_summary.append(f"Vibe: '{pref.vibe_query}'")

            pref_text = f" [{', '.join(pref_summary)}]" if pref_summary else ""

            reply = (
                f"(Note: GEMINI_API_KEY is not set; running offline trade-off agent) "
                f"I've analyzed options based on your preferences{pref_text}. "
                f"Here are 3 labelled trade-off choices for your move to Sydney:\n"
                f"{options_text}\n\n"
                f"Select any card on the right to view transit details or refine your criteria!"
            )
            return {
                "reply": reply,
                "actions": [
                    {
                        "action_type": "tradeoff_recommendations",
                        "data": {"tradeoffs": [opt.model_dump() for opt in tradeoffs]}
                    },
                    {
                        "action_type": "update_properties",
                        "data": {"properties": [opt.property.model_dump() for opt in tradeoffs]}
                    }
                ],
                "tradeoffs": [opt.model_dump() for opt in tradeoffs],
                "session_preferences": pref.model_dump()
            }

        # Live Gemini API Call with session-aware system instruction
        client = genai.Client(api_key=api_key)
        contents = []
        for h in history:
            contents.append(
                types.Content(role=h["role"], parts=[types.Part.from_text(text=h["parts"])])
            )
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=message)])
        )

        tradeoff_summary = "\n".join(
            [f"- {opt.label}: {opt.property.title} in {opt.property.suburb} at ${opt.property.weekly_rent}/wk, {opt.commute_minutes}m to {target_hub} ({opt.reasoning})" for opt in tradeoffs]
        )

        system_instruction = (
            f"You are SydLiving AI, an expert Sydney relocation and housing discovery assistant. "
            f"Active Session Constraints: Max Rent: ${pref.max_rent}, Min Beds: {pref.min_bedrooms}, "
            f"Destination Hub: {target_hub}, Vibe: {pref.vibe_query}. "
            f"Calculated Trade-Off Options:\n{tradeoff_summary}\n"
            f"You have access to tools for querying properties, calculating commute times, searching nearby places, and checking commute reach. "
            f"Always present 2-3 clear labelled trade-off options (Cheapest, Fastest Commute, Best Overall) "
            f"so the user can weigh their decision. Keep explanations friendly, concise, and grounded in Sydney transit reality."
        )

        tools = [query_properties_tool, get_commute_tool, get_places_tool, filter_by_commute_reach_tool]
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=tools,
            temperature=0.3,
        )

        model_name = "gemini-2.5-flash"
        chat = client.chats.create(model=model_name, config=config)
        if history:
            chat._history = contents[:-1]

        try:
            response = chat.send_message(message)
        except Exception as api_err:
            if "503" in str(api_err) or "UNAVAILABLE" in str(api_err) or "not found" in str(api_err).lower():
                model_name = "gemini-2.0-flash"
                chat = client.chats.create(model=model_name, config=config)
                if history:
                    chat._history = contents[:-1]
                response = chat.send_message(message)
            else:
                raise api_err

        actions = [
            {
                "action_type": "tradeoff_recommendations",
                "data": {"tradeoffs": [opt.model_dump() for opt in tradeoffs]}
            }
        ]

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
        if hasattr(response, 'text') and response.text:
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
            "actions": actions,
            "tradeoffs": [opt.model_dump() for opt in tradeoffs],
            "session_preferences": pref.model_dump()
        }

    except Exception as e:
        print(f"[Agent] ERROR IN process_chat: {str(e)}")
        traceback.print_exc()
        error_msg = str(e)
        if "503" in error_msg or "UNAVAILABLE" in error_msg:
            return {
                "reply": "I'm sorry, but my AI brain is currently experiencing high demand. Please try again in a few moments!",
                "actions": [],
                "tradeoffs": [],
                "session_preferences": None
            }
        elif "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            return {
                "reply": "I'm sorry, but we've hit our API rate limits. Please try again in a minute.",
                "actions": [],
                "tradeoffs": [],
                "session_preferences": None
            }
            
        return {
            "reply": f"Oops! I encountered an internal error: {type(e).__name__}. Please try again.",
            "actions": [],
            "tradeoffs": [],
            "session_preferences": None
        }
