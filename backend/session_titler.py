import re
import os
import sqlite3
import asyncio
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()


def clean_heuristic_title(text: str) -> str:
    """Produces a clean, human-readable 3-7 word title from a user query without mid-word cuts."""
    if not text:
        return "New Chat"

    # 1. Unpack markdown property links: [Title](property:id) -> Title
    cleaned = re.sub(r'\[([^\]]+)\]\(property:[^\)]+\)', r'\1', text)
    # Strip standard markdown links: [text](url) -> text
    cleaned = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', cleaned)

    # 2. Strip system / agent prefixes
    cleaned = re.sub(r'^\[(?:Deep|Standard|Kai)\]\s*', '', cleaned, flags=re.IGNORECASE)

    # 3. Strip conversational fluff / question preambles
    patterns = [
        r'^(?:give me your candid insider evaluation of|give me your candid insider take on|give me your candid take on|candid evaluation of)\s+',
        r'^(?:how is the coastal and beach lifestyle near|how is the coastal and beach lifestyle in)\s+',
        r'^(?:what is the commute from|fast commute from|commute from)\s+',
        r'^(?:fast commute to|commute to)\s+',
        r'^(?:can you compare|please compare|compare)\s+',
        r'^(?:can you show me|please show me|show me|show)\s+',
        r'^(?:is \$\d+[\d,\.]*(?:\/wk)? good value for)\s+',
        r'^(?:is this good value for|is it good value for)\s+',
        r'^(?:how is the|what is the|what\'s the|tell me about)\s+',
        r'^(?:find places in|find spots in|find)\s+',
    ]
    for pat in patterns:
        cleaned = re.sub(pat, '', cleaned, flags=re.IGNORECASE).strip()

    # 4. Clean trailing question marks, colons, or sentences
    cleaned = re.sub(r'[\?\.\!\:\;]+$', '', cleaned).strip()

    # 5. Extract first sentence or clause if multi-sentence
    if '.' in cleaned:
        cleaned = cleaned.split('.')[0].strip()
    if '?' in cleaned:
        cleaned = cleaned.split('?')[0].strip()

    # Capitalize first letter
    if cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]

    # 6. Truncate at whole word boundary to max 42 characters
    if len(cleaned) > 42:
        cutoff = cleaned[:42]
        if ' ' in cutoff:
            cleaned = cutoff.rsplit(' ', 1)[0].rstrip(' ,;:-') + '...'
        else:
            cleaned = cutoff.rstrip(' ,;:-') + '...'

    return cleaned.strip() if len(cleaned) >= 3 else text[:30].strip()


async def generate_ai_title(message: str) -> Optional[str]:
    """Generates an ultra-crisp, descriptive 3 to 6 word title using Gemini."""
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return None

    try:
        from google import genai
        client = genai.Client(api_key=gemini_key)

        prompt = (
            "You are naming a chat session for a Sydney housing search and relocation concierge app.\n"
            "Given the user's initial inquiry, generate a concise, human-friendly 3 to 6 word title.\n"
            "Focus on the specific suburb, property, commute, or question topic.\n"
            "Examples:\n"
            "- 'Give me your candid insider evaluation of 7/150 Wells Street Newtown' -> Newtown 1BR: 7/150 Wells St\n"
            "- 'How is the coastal and beach lifestyle near 7/150 Wells Street?' -> Newtown Beach & Coastal Access\n"
            "- 'Show 2-bedroom rentals near Sydney Metro stations with high walkability' -> 2BR Rentals Near Sydney Metro\n"
            "- 'Is $1380/week good value for this 2BR 1Bath property in Coogee?' -> Coogee 2BR Rental Value Check\n"
            "- 'Fast commute to Barangaroo from Newtown' -> Barangaroo Commute from Newtown\n"
            "- 'Find cafes and gyms in Surry Hills' -> Surry Hills Cafes & Gyms\n\n"
            "CRITICAL RULES:\n"
            "- Length: 3 to 6 words maximum.\n"
            "- Return ONLY the title text. Do not wrap in quotes or brackets, and do not end with a period or prefix like 'Title:'.\n\n"
            f"User inquiry:\n{message[:300]}"
        )

        model_name = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
        from google.genai import types
        config = types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=30,
            tools=[]
        )
        
        # Run in thread or direct call
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config
            )
        )

        raw_title = ""
        if response.text:
            raw_title = response.text.strip()
        elif hasattr(response, 'candidates') and response.candidates:
            for c in response.candidates:
                if c.content and c.content.parts:
                    for p in c.content.parts:
                        if p.text:
                            raw_title += p.text

        title = raw_title.strip().strip('"\'`').strip()
        title = re.sub(r'^(title|topic|subject):\s*', '', title, flags=re.IGNORECASE)
        title = title.split('\n')[0].strip()

        # Sanity check length and quality
        words = title.split()
        if 2 <= len(words) <= 8 and len(title) <= 55 and not title.lower().startswith(("here", "sure", "sorry")):
            return title
    except Exception as e:
        print(f"[Titler] Gemini AI title generation note: {e}")

    return None


async def generate_smart_title(message: str) -> str:
    """Combines AI generation with clean heuristic fallback."""
    ai_title = await generate_ai_title(message)
    if ai_title:
        return ai_title
    return clean_heuristic_title(message)


async def update_session_title_async(session_id: str, message: str, db_path: str):
    """Background task to generate AI title and update session in DB."""
    try:
        # Give a micro-yield to allow main response to start sending
        await asyncio.sleep(0.3)
        smart_title = await generate_smart_title(message)
        if not smart_title:
            return

        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (smart_title, session_id))
            conn.commit()
            print(f"[Titler] Updated session {session_id[:8]} title to: '{smart_title}'")
    except Exception as err:
        print(f"[Titler] Error updating session title asynchronously: {err}")


def migrate_legacy_session_titles(conn: sqlite3.Connection):
    """Migrates any existing sessions with '[Deep]' or truncated raw prompts to clean titles."""
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, title FROM chat_sessions WHERE title LIKE '[Deep]%' OR title LIKE '%...' OR title IS NULL OR title = 'New Chat'"
        )
        legacy_rows = cursor.fetchall()
        if not legacy_rows:
            return

        for row in legacy_rows:
            s_id = row[0]
            # Fetch first user message
            cursor.execute(
                "SELECT content FROM chat_messages WHERE session_id = ? AND role = 'user' ORDER BY created_at ASC LIMIT 1",
                (s_id,)
            )
            msg_row = cursor.fetchone()
            if msg_row and msg_row[0]:
                new_title = clean_heuristic_title(msg_row[0])
                cursor.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (new_title, s_id))
        conn.commit()
    except Exception as e:
        print(f"[Titler] Legacy session title migration note: {e}")
