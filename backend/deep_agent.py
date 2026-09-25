import os
import json
import sqlite3
import time
import traceback
import contextvars
from typing import List, Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
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

def create_deep_sydliving_agent(model_name: Optional[str] = None):
    """Instantiates a Deep Agent compiled graph with subagents and planning capabilities."""
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not gemini_key:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is not configured.")

    # Ensure langchain-google-genai uses the Gemini key rather than Maps key
    os.environ["GOOGLE_API_KEY"] = gemini_key

    # Primary model: gemini-3.8-flash default, configurable via GEMINI_MODEL
    active_model = model_name or os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
    model = ChatGoogleGenerativeAI(
        model=active_model,
        google_api_key=gemini_key,
        temperature=0.6,
        max_retries=1
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
        "You are Kai, Sydney's dedicated AI Living & Relocation Concierge.\n"
        "You're not a dry corporate chatbot or a generic real estate agent—you are an upbeat, savvy, candid Sydney insider who knows every harbor bay, ridge, train line, and flat-white hotspot across Greater Sydney.\n\n"
        "YOUR PERSONALITY & VOICE:\n"
        "- Friendly, warm, charismatic, and conversational. Speak in the first person ('I', 'my take', 'G'day!').\n"
        "- Authentic local color: You live and breathe Sydney—early morning ocean swims at Bronte Baths or Icebergs, grabbing a flat white on Hall Street or Crown Street, catching the F1 Manly ferry past the Heads, the morning squeeze on the 379 or 333 bus, or flying through the harbor tunnel on the Sydney Metro M1.\n"
        "- Avoid dry, clinical, encyclopedic reports. Never format your response as a sterile numbered academic essay (e.g. avoid '1. The Vibe & Crowd', '2. Real Estate Breakdown'). Instead, tell a vivid, engaging story, use conversational section headings, and speak directly to the user as a trusted friend over coffee.\n"
        "- Share Kai's Local Insider Tips ('💡 Kai's Insider Tip: ...') highlighting little-known local secrets (e.g. morning sun orientations, parking headaches, bus lane speed vs train convenience, beach wind directions).\n"
        "- Offer a clear, opinionated Verdict ('🎯 My Verdict: ...') that cuts through the noise and tells the user who each suburb or property is really best for.\n"
        "- Be encouraging and pragmatic: Celebrate great finds, point out honest downsides (e.g. aircraft noise in the inner west, steep hills in Coogee, summer tourist madness in Bondi), and always respect their budget and transit needs.\n\n"
        "YOUR SPECIALIZED TEAM:\n"
        "You orchestrate a team of specialized subagents to gather accurate facts:\n"
        " - property_scout: Searches verified Domain and local database listings.\n"
        " - commute_specialist: Computes real door-to-door transit times across Metro M1, trains, ferries, and buses.\n"
        " - lifestyle_scout: Checks cafes, gyms, beaches, grocers, and amenities via Google Places.\n\n"
        "CRITICAL PROPERTY LINKING RULE:\n"
        "Whenever you recommend, list, or compare rental properties, ALWAYS format each property title as a clickable markdown link using its exact 'id' from the tool results or user prompt:\n"
        "[Property Title](property:<id>)\n"
        "Example: [Light-Filled 1BR Studio Loft](property:08322db0-85b8-217113b88abd) in Crows Nest ($640/wk)\n"
        "Never output a property name as plain text without linking its ID. This allows users to click the listing in the chat interface to highlight it on the map and view full specs."
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

        candidate_models = [
            os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"),
            "gemini-3.8-flash",
            "gemini-3.7-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash"
        ]
        models_to_try = []
        for m in candidate_models:
            if m and m not in models_to_try:
                models_to_try.append(m)

        res = None
        try:
            for m_idx, current_model in enumerate(models_to_try):
                try:
                    agent = create_deep_sydliving_agent(model_name=current_model)
                    res = agent.invoke({"messages": langchain_messages})
                    break
                except Exception as e:
                    err_text = str(e)
                    is_quota = "429" in err_text or "RESOURCE_EXHAUSTED" in err_text or "503" in err_text or "UNAVAILABLE" in err_text
                    if is_quota and m_idx < len(models_to_try) - 1:
                        print(f"[DeepAgent] Model {current_model} hit rate limit. Auto-falling back to {models_to_try[m_idx + 1]}...")
                        continue
                    raise e
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

async def stream_deep_chat(message: str, history: list):
    """Streams real-time thinking steps, subagent delegations, tool calls, and text chunks via SSE."""
    start_time = time.time()
    steps_log = []
    collected_actions = []
    accumulated_text = ""

    def sse(event_name: str, data: dict) -> str:
        return f"event: {event_name}\ndata: {json.dumps(data)}\n\n"

    try:
        gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not gemini_key:
            yield sse("error", {"message": "GEMINI_API_KEY is not configured.", "latency_seconds": 0.0})
            return

        yield sse("status", {
            "stage": "planning",
            "label": "🧠 Deep Agent is analyzing requirements and structuring relocation search..."
        })

        langchain_messages = []
        for h in history:
            role = h.get("role")
            content = h.get("parts", "")
            if role == "user":
                langchain_messages.append(HumanMessage(content=content))
            elif role == "model":
                langchain_messages.append(AIMessage(content=content))

        langchain_messages.append(HumanMessage(content=message))

        candidate_models = [
            os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"),
            "gemini-3.8-flash",
            "gemini-3.7-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash"
        ]
        models_to_try = []
        for m in candidate_models:
            if m and m not in models_to_try:
                models_to_try.append(m)

        for m_idx, current_model in enumerate(models_to_try):
            try:
                agent = create_deep_sydliving_agent(model_name=current_model)

                async for ev in agent.astream_events({"messages": langchain_messages}, version="v2"):
                    ev_type = ev.get("event")
                    name = ev.get("name", "")
                    run_id = ev.get("run_id", "")

                    if ev_type == "on_tool_start":
                        input_data = ev.get("data", {}).get("input", {})
                        step_obj = None

                        if name == "task":
                            subagent_type = input_data.get("subagent_type", "specialist")
                            desc = input_data.get("description", "")
                            label_map = {
                                "commute_specialist": "🚆 Commute Specialist calculating transit routes & ETA",
                                "property_scout": "🏠 Property Scout retrieving verified listings & prices",
                                "lifestyle_scout": "☕ Lifestyle Scout checking neighborhood amenities"
                            }
                            label = label_map.get(subagent_type, f"🤖 Consulting {subagent_type}...")
                            step_obj = {
                                "id": run_id,
                                "type": "subagent",
                                "name": subagent_type,
                                "label": label,
                                "detail": desc[:150] + "..." if len(desc) > 150 else desc,
                                "status": "running"
                            }

                        elif name == "write_todos":
                            step_obj = {
                                "id": run_id,
                                "type": "plan",
                                "name": "planner",
                                "label": "📋 Updating step-by-step relocation plan",
                                "detail": "Structured task milestones",
                                "status": "running"
                            }

                        elif name in ("deep_query_properties_tool", "query_properties_tool"):
                            suburb = input_data.get("suburb", "")
                            max_rent = input_data.get("max_rent", 99999.0)
                            min_beds = input_data.get("min_bedrooms", 0)
                            step_obj = {
                                "id": run_id,
                                "type": "tool",
                                "name": "property_search",
                                "label": f"🏠 Searching listings in {suburb or 'Sydney'}",
                                "detail": f"Max rent: ${max_rent}/wk, Min beds: {min_beds}",
                                "status": "running"
                            }
                            action_item = {"action_type": "update_properties", "data": input_data}
                            if action_item not in collected_actions:
                                collected_actions.append(action_item)
                                yield sse("action", action_item)

                        elif name in ("deep_filter_by_commute_reach_tool", "filter_by_commute_reach_tool"):
                            hub = input_data.get("destination_hub", "Barangaroo")
                            max_mins = input_data.get("max_commute_minutes", 35)
                            step_obj = {
                                "id": run_id,
                                "type": "tool",
                                "name": "commute_filter",
                                "label": f"🚆 Filtering {hub} reach within {max_mins} mins",
                                "detail": f"Door-to-door transit isochrone reach to {hub}",
                                "status": "running"
                            }
                            action_item = {"action_type": "update_commute_filters", "data": input_data}
                            if action_item not in collected_actions:
                                collected_actions.append(action_item)
                                yield sse("action", action_item)

                        elif name in ("deep_get_commute_tool", "get_commute_tool"):
                            orig = input_data.get("origin_suburb", "")
                            dest = input_data.get("destination_cbd_hub", "")
                            step_obj = {
                                "id": run_id,
                                "type": "tool",
                                "name": "commute_matrix",
                                "label": f"⏱️ Calculating door-to-door route: {orig} → {dest}",
                                "detail": f"Metro, train, bus, ferry connections",
                                "status": "running"
                            }
                            action_item = {"action_type": "update_commute", "data": input_data}
                            if action_item not in collected_actions:
                                collected_actions.append(action_item)
                                yield sse("action", action_item)

                        elif name in ("deep_get_places_tool", "get_places_tool"):
                            sub = input_data.get("suburb", "")
                            ptype = input_data.get("place_type", "cafe")
                            step_obj = {
                                "id": run_id,
                                "type": "tool",
                                "name": "places",
                                "label": f"☕ Scouting {ptype}s in {sub}",
                                "detail": f"Local cafes, gyms, and lifestyle spots",
                                "status": "running"
                            }
                            action_item = {"action_type": "update_places", "data": input_data}
                            if action_item not in collected_actions:
                                collected_actions.append(action_item)
                                yield sse("action", action_item)

                        if step_obj:
                            steps_log.append(step_obj)
                            yield sse("step", step_obj)

                    elif ev_type == "on_tool_end":
                        for s in steps_log:
                            if s.get("id") == run_id:
                                s["status"] = "completed"
                        yield sse("step_done", {"id": run_id, "name": name})

                    elif ev_type == "on_chat_model_stream":
                        chunk = ev.get("data", {}).get("chunk")
                        content = getattr(chunk, "content", chunk) if chunk else None
                        chunk_text = ""
                        if isinstance(content, str):
                            chunk_text = content
                        elif isinstance(content, list):
                            parts = []
                            for p in content:
                                if isinstance(p, dict) and p.get("type") == "text":
                                    parts.append(p.get("text", ""))
                                elif isinstance(p, str):
                                    parts.append(p)
                            chunk_text = "".join(parts)

                        if chunk_text:
                            accumulated_text += chunk_text
                            yield sse("chunk", {"text": chunk_text})

                break  # Stream completed successfully
            except Exception as stream_err:
                err_text = str(stream_err)
                is_quota = "429" in err_text or "RESOURCE_EXHAUSTED" in err_text or "503" in err_text or "UNAVAILABLE" in err_text
                has_next = m_idx < len(models_to_try) - 1
                if is_quota and has_next and not accumulated_text:
                    next_model = models_to_try[m_idx + 1]
                    print(f"[DeepAgent Stream] Model {current_model} rate limited or unavailable. Auto-falling back to {next_model}...")
                    yield sse("status", {
                        "stage": "fallback",
                        "label": f"⚡ Switched model to {next_model} to avoid rate limits..."
                    })
                    continue
                else:
                    raise stream_err

        elapsed = round(time.time() - start_time, 2)
        if not accumulated_text:
            accumulated_text = "I've synthesized the research and updated the map and property listings accordingly."

        yield sse("done", {
            "reply": accumulated_text,
            "actions": collected_actions,
            "latency_seconds": elapsed,
            "steps": steps_log,
            "agent_type": "deep_agent"
        })

    except Exception as e:
        elapsed = round(time.time() - start_time, 2)
        print(f"[DeepAgent Stream] ERROR: {str(e)}")
        traceback.print_exc()
        err_str = str(e)
        user_msg = f"Oops! Deep Agent encountered an error: {type(e).__name__}."
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            user_msg = "I'm sorry, but we've temporarily hit API rate limits for complex multi-agent reasoning. Please try again in a minute."
        elif "503" in err_str or "UNAVAILABLE" in err_str:
            user_msg = "The AI model is currently under high demand. Please retry in a few moments."
            
        yield sse("error", {
            "message": user_msg,
            "latency_seconds": elapsed,
            "steps": steps_log,
            "actions": collected_actions
        })

