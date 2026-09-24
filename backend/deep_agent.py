import os
import json
import sqlite3
import time
import traceback
import contextvars
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage
from deepagents import create_deep_agent

from integrations import fetch_domain_properties, fetch_google_commute, fetch_google_places
from database import DB_PATH

# ContextVar to capture tool execution side-effects across the deep agent run
_active_actions_collector: contextvars.ContextVar[Optional[List[Dict[str, Any]]]] = contextvars.ContextVar(
    "deep_agent_actions_collector", default=None
)

def _record_action(action_type: str, data: dict):
    collector = _active_actions_collector.get()
    if collector is not None:
        action_item = {"action_type": action_type, "data": data}
        if action_item not in collector:
            collector.append(action_item)

def deep_query_properties_tool(suburb: str = "", max_rent: float = 99999.0, min_bedrooms: int = 0) -> str:
    """Queries real-world Domain API and local database for rental properties matching criteria.
    Args:
        suburb: A specific suburb to filter by, or empty string "" if none.
        max_rent: Maximum weekly rent in AUD, or 99999.0 if no maximum.
        min_bedrooms: Minimum number of bedrooms, or 0 if no minimum.
    """
    _record_action("update_properties", {
        "suburb": suburb,
        "max_rent": max_rent,
        "min_bedrooms": min_bedrooms
    })
    try:
        results = fetch_domain_properties(suburb, max_rent, min_bedrooms)
        return json.dumps({"properties": results, "count": len(results)})
    except Exception as e:
        return json.dumps({"error": str(e)})

def deep_get_commute_tool(origin_suburb: str, destination_cbd_hub: str) -> str:
    """Looks up the door-to-door commute time and transit mode between an origin suburb and a destination hub.
    Args:
        origin_suburb: The starting suburb (e.g. 'Bondi Beach', 'Coogee', 'Manly', 'Crows Nest', 'Newtown').
        destination_cbd_hub: The destination hub (e.g. 'Barangaroo', 'Martin Place', 'Central', 'Victoria Cross (North Sydney)', 'Macquarie Park', 'Parramatta').
    """
    _record_action("update_commute", {
        "origin_suburb": origin_suburb,
        "destination_cbd_hub": destination_cbd_hub
    })
    try:
        results = fetch_google_commute(origin_suburb, destination_cbd_hub)
        return json.dumps({"commutes": results})
    except Exception as e:
        return json.dumps({"error": str(e)})

def deep_get_places_tool(suburb: str, place_type: str) -> str:
    """Looks up real-world Google Places (gyms, cafes, transit, supermarkets) in a suburb.
    Args:
        suburb: The suburb (e.g. 'Bondi', 'Crows Nest', 'Manly').
        place_type: The type of place (e.g. 'cafe', 'gym', 'transit_station', 'supermarket', 'park').
    """
    _record_action("update_places", {
        "suburb": suburb,
        "place_type": place_type
    })
    try:
        results = fetch_google_places(suburb, place_type)
        return json.dumps({"places": results})
    except Exception as e:
        return json.dumps({"error": str(e)})

def deep_filter_by_commute_reach_tool(destination_hub: str, max_commute_minutes: int, max_rent: float = 99999.0, min_bedrooms: int = 0) -> str:
    """Finds properties and suburbs within a specified transit commute travel time (isochrone reach) to a destination hub.
    Args:
        destination_hub: Destination employment/CBD hub (e.g. 'Barangaroo', 'Martin Place', 'Central', 'Victoria Cross (North Sydney)', 'Macquarie Park', 'Parramatta').
        max_commute_minutes: Maximum travel time in minutes (e.g. 15, 25, 30, 45).
        max_rent: Maximum weekly rent in AUD, or 99999.0 if no maximum.
        min_bedrooms: Minimum number of bedrooms, or 0 if no minimum.
    """
    _record_action("update_commute_filters", {
        "destination_hub": destination_hub,
        "max_commute_minutes": max_commute_minutes,
        "max_rent": max_rent,
        "min_bedrooms": min_bedrooms
    })
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
        return json.dumps({
            "matching_properties": results,
            "total_found": len(results),
            "hub": destination_hub,
            "max_minutes": max_commute_minutes
        })
    except Exception as e:
        return json.dumps({"error": str(e)})
    finally:
        db.close()

# Subagent definitions
property_subagent = {
    "name": "property_scout",
    "description": "Specialist in searching Domain and database rental listings by budget, bedrooms, and location.",
    "system_prompt": (
        "You are a Sydney real estate specialist. Your goal is to find rental properties matching user preferences. "
        "Always use deep_query_properties_tool to retrieve verified properties from Domain and the local database."
    ),
    "tools": [deep_query_properties_tool]
}

commute_subagent = {
    "name": "commute_specialist",
    "description": "Specialist in Greater Sydney transit networks (Sydney Metro M1, Sydney Trains, Ferries, Light Rail) and commute isochrone reach.",
    "system_prompt": (
        "You are a Sydney transit and commute specialist. Use deep_get_commute_tool and deep_filter_by_commute_reach_tool "
        "to calculate door-to-door transit times and find suburbs within reach of employment hubs."
    ),
    "tools": [deep_get_commute_tool, deep_filter_by_commute_reach_tool]
}

lifestyle_subagent = {
    "name": "lifestyle_scout",
    "description": "Specialist in researching neighborhood amenities like gyms, coffee shops, beaches, and supermarkets in Sydney suburbs.",
    "system_prompt": (
        "You analyze neighborhood quality of life and proximity to daily amenities. "
        "Always use deep_get_places_tool to check cafes, gyms, and local facilities."
    ),
    "tools": [deep_get_places_tool]
}

def create_deep_sydliving_agent():
    """Instantiates a Deep Agent compiled graph with subagents and planning capabilities."""
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not gemini_key:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is not configured.")

    # Primary model: gemini-3.7-flash
    model = ChatGoogleGenerativeAI(
        model="gemini-3.7-flash",
        google_api_key=gemini_key,
        temperature=0.2
    )

    top_level_tools = [
        deep_query_properties_tool,
        deep_get_commute_tool,
        deep_get_places_tool,
        deep_filter_by_commute_reach_tool
    ]

    subagents = [
        property_subagent,
        commute_subagent,
        lifestyle_subagent
    ]

    system_prompt = (
        "You are SydLiving AI (Deep Agent Harness), Sydney's autonomous relocation intelligence assistant.\n"
        "You have access to specialized subagents:\n"
        " - property_scout: Searches Domain and database rentals by budget, bedrooms, and location.\n"
        " - commute_specialist: Computes transit times across Sydney Metro M1, trains, ferries, and buses.\n"
        " - lifestyle_scout: Finds cafes, gyms, beaches, and local facilities via Google Places.\n\n"
        "When handling complex or multi-criteria queries (e.g. commute + rent + lifestyle), plan your approach, "
        "delegate to the appropriate specialist subagent, or use the tools directly to get exact data. "
        "Synthesize all findings into a structured, clear, and reassuring recommendation highlighting travel times, "
        "specific transit lines, and rental costs."
    )

    return create_deep_agent(
        model=model,
        tools=top_level_tools,
        subagents=subagents,
        system_prompt=system_prompt
    )

async def process_deep_chat(message: str, history: list) -> dict:
    """Processes a user message using LangChain Deep Agents with execution tracking and action collection."""
    start_time = time.time()
    try:
        gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not gemini_key:
            return {
                "reply": "Error: GEMINI_API_KEY is not set in the backend environment. Please configure it to enable the Deep Agent.",
                "actions": [],
                "latency_seconds": 0.0,
                "agent_type": "deep_agent"
            }

        agent = create_deep_sydliving_agent()

        # Format history into LangChain messages
        langchain_messages = []
        for h in history:
            role = h.get("role")
            content = h.get("parts", "")
            if role == "user":
                langchain_messages.append(HumanMessage(content=content))
            elif role == "model":
                langchain_messages.append(AIMessage(content=content))

        langchain_messages.append(HumanMessage(content=message))

        collected_actions: List[Dict[str, Any]] = []
        token = _active_actions_collector.set(collected_actions)

        try:
            res = agent.invoke({"messages": langchain_messages})
        finally:
            _active_actions_collector.reset(token)

        # Extract reply text from the last message in trace
        reply_text = ""
        if "messages" in res and res["messages"]:
            last_msg = res["messages"][-1]
            if isinstance(last_msg.content, str):
                reply_text = last_msg.content
            elif isinstance(last_msg.content, list):
                text_parts = []
                for part in last_msg.content:
                    if isinstance(part, dict) and "text" in part:
                        text_parts.append(part["text"])
                    elif isinstance(part, str):
                        text_parts.append(part)
                reply_text = "\n".join(text_parts)

            # Also check if any tool_calls in message trace weren't caught by contextvars
            for msg in res["messages"]:
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tc in msg.tool_calls:
                        name = tc.get("name", "")
                        args = tc.get("args", {})
                        action_type = None
                        if name in ("deep_query_properties_tool", "query_properties_tool"):
                            action_type = "update_properties"
                        elif name in ("deep_get_commute_tool", "get_commute_tool"):
                            action_type = "update_commute"
                        elif name in ("deep_get_places_tool", "get_places_tool"):
                            action_type = "update_places"
                        elif name in ("deep_filter_by_commute_reach_tool", "filter_by_commute_reach_tool"):
                            action_type = "update_commute_filters"
                        
                        if action_type:
                            act = {"action_type": action_type, "data": args}
                            if act not in collected_actions:
                                collected_actions.append(act)

        if not reply_text:
            reply_text = "I've synthesized the research and updated the map and property listings accordingly."

        elapsed = round(time.time() - start_time, 2)

        return {
            "reply": reply_text,
            "actions": collected_actions,
            "latency_seconds": elapsed,
            "agent_type": "deep_agent",
            "message_count": len(res.get("messages", []))
        }

    except Exception as e:
        elapsed = round(time.time() - start_time, 2)
        print(f"[DeepAgent] ERROR IN process_deep_chat: {str(e)}")
        traceback.print_exc()
        
        error_msg = str(e)
        if "503" in error_msg or "UNAVAILABLE" in error_msg:
            return {
                "reply": "I'm sorry, but my Deep Agent brain is currently experiencing high demand. Please try again shortly!",
                "actions": [],
                "latency_seconds": elapsed,
                "agent_type": "deep_agent"
            }
        elif "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            return {
                "reply": "I'm sorry, but we've temporarily hit API rate limits for complex multi-agent reasoning. Please try again in a minute.",
                "actions": [],
                "latency_seconds": elapsed,
                "agent_type": "deep_agent"
            }

        return {
            "reply": f"Deep Agent encountered an error ({type(e).__name__}): {str(e)}",
            "actions": [],
            "latency_seconds": elapsed,
            "agent_type": "deep_agent"
        }
