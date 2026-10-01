import os
import sqlite3
import json
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

from database import get_db_connection
from integrations import fetch_domain_properties, fetch_google_commute, fetch_google_places, fetch_local_recommendations

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

def get_local_recommendations_tool(
    suburb: str = "",
    query: str = "cafe",
    property_id: str = "",
    radius_meters: int = 1500
) -> str:
    """Discovers and ranks top local cafes, restaurants, bakeries, and eateries near a property listing or suburb.
    Weighs up star rating and review count to deliver the most credible Sydney favorites.
    Args:
        suburb: Suburb name (e.g. 'Surry Hills', 'Bondi Beach', 'Newtown', 'Crows Nest', 'Manly').
        query: Specific category or preference (e.g. 'cafe', 'specialty coffee', 'brunch', 'italian restaurant', 'dinner', 'bakery').
        property_id: Optional ID of the rental property to calculate exact walking distance from.
        radius_meters: Search radius in meters (default 1500 for walking distance).
    """
    from database import DB_PATH
    lat, lng = None, None
    if property_id:
        try:
            with sqlite3.connect(DB_PATH) as db:
                db.row_factory = sqlite3.Row
                cur = db.cursor()
                cur.execute("SELECT suburb, latitude, longitude FROM properties WHERE id = ?", (property_id,))
                row = cur.fetchone()
                if row:
                    if not suburb:
                        suburb = row["suburb"]
                    lat = row["latitude"]
                    lng = row["longitude"]
        except Exception as e:
            print(f"[Agent] Error looking up property {property_id}: {e}")

    try:
        results = fetch_local_recommendations(
            suburb=suburb,
            query=query,
            latitude=lat,
            longitude=lng,
            radius_meters=radius_meters
        )
        return json.dumps({
            "places": results,
            "suburb": suburb,
            "query": query,
            "property_id": property_id,
            "count": len(results)
        })
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
        results = fetch_local_recommendations(suburb=suburb, query=place_type)
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

async def process_chat(message: str, history: list, user_profile: Optional[dict] = None, property_context: Optional[dict] = None) -> dict:
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

        verbosity = "concise"
        if user_profile and user_profile.get("kai_verbosity"):
            v = str(user_profile["kai_verbosity"]).lower().strip()
            if v in ("concise", "balanced", "detailed"):
                verbosity = v

        if verbosity == "concise":
            verbosity_instruction = """
STRICT LENGTH & CONCISENESS RULES (ACTIVE STYLE: CONCISE / PUNCHY - DEFAULT):
- BE SHARP, PUNCHY, AND SCANNABLE. The user wants quick, high-impact advice—NOT an essay or wall of text.
- Hard limit: Keep the ENTIRE reply under 180 words.
- NO long warmups, preambles, or repeated introductory sentences. Get straight to the answer in the first sentence.
- NO massive multi-row markdown tables unless the user explicitly requested a table. Use 2 to 3 concise bullet points instead.
- Reply Structure:
  1. Direct Answer (1 sentence): Instant answer to their question.
  2. 2-3 Scannable Bullets: Key numbers, rent benchmarks, transit facts, or top recommendations.
  3. 💡 Kai's Insider Tip: 1 punchy Sydney insider observation.
  4. 🎯 My Verdict: 1 decisive closing sentence."""
        elif verbosity == "balanced":
            verbosity_instruction = """
RESPONSE LENGTH & STRUCTURE RULES (ACTIVE STYLE: BALANCED):
- Keep the response focused, structured, and around 200-260 words.
- Direct answer upfront, followed by concise sections with bullet points or a brief comparison.
- Avoid rambling or duplicate narrative.
- Include 1 '💡 Kai's Insider Tip' and 1 '🎯 My Verdict'."""
        else:
            verbosity_instruction = """
RESPONSE LENGTH & STRUCTURE RULES (ACTIVE STYLE: DETAILED):
- Provide a comprehensive, in-depth evaluation (~350-450 words) with full market benchmark ranges, transit line comparisons, and neighborhood vibe nuances.
- Markdown tables are welcome when comparing multiple listings or pricing tiers.
- Include '💡 Kai's Insider Tip' and '🎯 My Verdict'."""
        
        system_instruction = f"""You are Kai, Sydney's dedicated AI Living & Relocation Concierge.
You're not a dry corporate chatbot or a generic real estate agent—you are an upbeat, savvy, candid Sydney insider who knows every harbor bay, ridge, train line, and flat-white hotspot across Greater Sydney.

YOUR PERSONALITY & VOICE:
- Friendly, warm, charismatic, and conversational. Speak in the first person ('I', 'my take', 'G'day!').
- Authentic local color: You live and breathe Sydney—early morning ocean swims at Bronte Baths or Icebergs, grabbing a flat white on Hall Street or Crown Street, catching the F1 Manly ferry past the Heads, the morning squeeze on the 379 or 333 bus, or flying through the harbor tunnel on the Sydney Metro M1.
- Avoid dry, clinical, encyclopedic reports. Never format your response as a sterile numbered academic essay (e.g. avoid '1. The Vibe & Crowd', '2. Real Estate Breakdown'). Instead, tell a vivid, engaging story, use conversational section headings, and speak directly to the user as a trusted friend over coffee.
- Share Kai's Local Insider Tips ('💡 Kai's Insider Tip: ...') highlighting little-known local secrets (e.g. morning sun orientations, parking headaches, bus lane speed vs train convenience, beach wind directions).
- Offer a clear, opinionated Verdict ('🎯 My Verdict: ...') that cuts through the noise and tells the user who each suburb or property is really best for.
- Be encouraging and pragmatic: Celebrate great finds, point out honest downsides (e.g. aircraft noise in the inner west, steep hills in Coogee, summer tourist madness in Bondi), and always respect their budget and transit needs.

CRITICAL PROPERTY LINKING RULE:
Whenever you recommend, list, or compare rental properties, ALWAYS format each property title as a markdown link using its exact 'id' from the tool results:
[Property Title](property:<id>)
Example: [Light-Filled 1BR Studio Loft](property:08322db0-85b8-217113b88abd) in Crows Nest ($640/wk).
Never output a property name as plain text without linking its ID. This allows users to click the listing in the chat interface to highlight it on the map and view full specs.

LOCAL CAFE & RESTAURANT RECOMMENDATIONS RULE:
When a user asks for local cafes, restaurants, bakeries, coffee, or dining recommendations (especially for a specific listing or neighborhood):
- ALWAYS call `get_local_recommendations_tool` (or `get_places_tool`) passing the property_id or suburb and query.
- Deliver exactly the **Top 3** spots, carefully weighing up both high star ratings (e.g. 4.5+) AND substantial review counts (e.g. hundreds or thousands of reviews) so recommendations are proven, beloved Sydney institutions.
- Format each of the 3 recommendations clearly:
  - **[Venue Name]** — ⭐ [Rating] ([Number of reviews] reviews)
  - 🚶 **Distance / Walk**: [e.g. 450m • 6 min walk from the listing]
  - 🏷️ **Type & Price**: [e.g. Specialty Coffee & Brunch • $$]
  - 💡 **Kai's Insider Takeaway**: Specific must-order dish or drink and why it matches their query (e.g. "Order the ricotta hotcakes and batch brew; sunny courtyard fills fast by 9:30 AM").
- Finish with 🎯 My Verdict on the immediate neighborhood vibe and culinary scene.
{verbosity_instruction}"""
        
        if property_context:
            system_instruction += f"""

CURRENTLY VIEWED LISTING CONTEXT:
- Active Listing: [{property_context.get('title', 'Active Listing')}](property:{property_context.get('id', '')})
- Suburb: {property_context.get('suburb', '')}
- Address: {property_context.get('address', '')}
- Coordinates: ({property_context.get('latitude')}, {property_context.get('longitude')})
- Rent: ${property_context.get('weekly_rent', 0)}/week ({property_context.get('bedrooms', 1)}BR)
When the user asks for local recommendations, cafes, restaurants, or spots "near here", "near this place", or "around the apartment", use this listing as the reference origin."""

        if user_profile:
            profile_lines = ["\nUSER RELOCATION & LIFESTYLE PROFILE (SAVED PREFERENCES):"]
            if user_profile.get("username"):
                profile_lines.append(f"- User Name: {user_profile['username']}")
            if user_profile.get("workplace_hub"):
                profile_lines.append(f"- Workplace / Commute Destination: {user_profile['workplace_hub']}")
            if user_profile.get("max_commute_mins"):
                profile_lines.append(f"- Maximum Commute Tolerance: {user_profile['max_commute_mins']} minutes")
            if user_profile.get("max_weekly_rent"):
                profile_lines.append(f"- Weekly Rent Target: ≤ ${user_profile['max_weekly_rent']}/wk ({user_profile.get('min_bedrooms', 1)}+ bedrooms)")
            if user_profile.get("has_pets"):
                profile_lines.append("- Pets: HAS PETS (requires pet-friendly rentals)")
            if user_profile.get("needs_parking"):
                profile_lines.append("- Vehicle: NEEDS PARKING (needs dedicated car space)")
            vibes = user_profile.get("lifestyle_vibes")
            if vibes and isinstance(vibes, list) and len(vibes) > 0:
                profile_lines.append(f"- Priority Lifestyle Vibes: {', '.join(vibes)}")
            modes = user_profile.get("preferred_transit_modes")
            if modes and isinstance(modes, list) and len(modes) > 0:
                profile_lines.append(f"- Preferred Transit Modes: {', '.join(modes)}")
            system_instruction += "\n" + "\n".join(profile_lines)

        tools = [query_properties_tool, get_commute_tool, get_places_tool, get_local_recommendations_tool, filter_by_commute_reach_tool]
        
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=tools,
            temperature=0.6,
        )
        
        model_name = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
        chat = client.chats.create(model=model_name, config=config)
        
        if history:
            chat._history = contents[:-1]
            
        try:
            response = chat.send_message(message)
        except Exception as api_err:
            if "503" in str(api_err) or "UNAVAILABLE" in str(api_err):
                model_name = "gemini-3.6-flash"
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
                            elif fc.name in ("get_places_tool", "get_local_recommendations_tool"):
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
