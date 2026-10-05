"""Admin analytics: request/external-API logging and read-only insight queries.

All timestamps are stored as naive local ISO-8601 strings (datetime.now().isoformat()),
matching the existing chat_sessions / chat_messages convention so range filters line up.
"""
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import database
from auth import admin_emails

LOG_RETENTION_DAYS = 30
RANGES = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30), "all": None}


def now_iso() -> str:
    return datetime.now().isoformat()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(database.DB_PATH, check_same_thread=False, timeout=5)
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def log_request(method: str, path: str, status: int, latency_ms: float, user_id: Optional[str]) -> None:
    try:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO api_requests (ts, method, path, status, latency_ms, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                (now_iso(), method, path, status, round(latency_ms, 2), user_id),
            )
    except Exception as e:
        print(f"[Analytics] Failed to log request: {e}")


def log_external_call(service: str, operation: str, success: bool, latency_ms: float,
                      tokens_in: Optional[int] = None, tokens_out: Optional[int] = None,
                      error: Optional[str] = None) -> None:
    try:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO external_api_calls (ts, service, operation, success, latency_ms, tokens_in, tokens_out, error) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (now_iso(), service, operation, 1 if success else 0, round(latency_ms, 2),
                 tokens_in, tokens_out, (error or "")[:500] or None),
            )
    except Exception as e:
        print(f"[Analytics] Failed to log external call: {e}")


@contextmanager
def track_external(service: str, operation: str):
    """Context manager that times an external call and logs it.

    The yielded dict can be mutated: set `success` (bool), `tokens_in`, `tokens_out`, `error`.
    An exception raised inside the block is logged as a failure and re-raised.
    """
    info: Dict = {"success": True, "tokens_in": None, "tokens_out": None, "error": None}
    start = time.perf_counter()
    try:
        yield info
    except Exception as e:
        info["success"] = False
        info["error"] = f"{type(e).__name__}: {e}"
        raise
    finally:
        log_external_call(service, operation, bool(info["success"]), (time.perf_counter() - start) * 1000,
                          info.get("tokens_in"), info.get("tokens_out"), info.get("error"))


def prune_logs(days: int = LOG_RETENTION_DAYS) -> None:
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    try:
        with _connect() as conn:
            conn.execute("DELETE FROM api_requests WHERE ts < ?", (cutoff,))
            conn.execute("DELETE FROM external_api_calls WHERE ts < ?", (cutoff,))
    except Exception as e:
        print(f"[Analytics] Failed to prune logs: {e}")


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

def _cutoff(range_key: str) -> Optional[str]:
    delta = RANGES.get(range_key, RANGES["7d"])
    return (datetime.now() - delta).isoformat() if delta else None


def _bucket_len(range_key: str) -> int:
    """substr length of the ISO timestamp used for grouping: hour buckets for 24h, otherwise days."""
    return 13 if range_key == "24h" else 10


def _admin_user_ids(db: sqlite3.Connection) -> List[str]:
    emails = list(admin_emails())
    if not emails:
        return []
    ph = ",".join("?" * len(emails))
    rows = db.execute(f"SELECT id FROM users WHERE lower(email) IN ({ph})", emails).fetchall()
    return [r["id"] for r in rows]


class _Filter:
    """Builds the shared WHERE fragments for time range + admin exclusion."""

    def __init__(self, db: sqlite3.Connection, range_key: str, include_admins: bool):
        self.range_key = range_key if range_key in RANGES else "7d"
        self.cutoff = _cutoff(self.range_key)
        self.bucket = _bucket_len(self.range_key)
        self.excluded = [] if include_admins else _admin_user_ids(db)

    def where(self, ts_col: Optional[str], user_col: Optional[str]) -> (str, list):
        clauses, params = [], []
        if ts_col and self.cutoff:
            clauses.append(f"{ts_col} >= ?")
            params.append(self.cutoff)
        if user_col and self.excluded:
            clauses.append(f"({user_col} IS NULL OR {user_col} NOT IN ({','.join('?' * len(self.excluded))}))")
            params.extend(self.excluded)
        return (" AND ".join(clauses) or "1=1"), params


def _series(db, sql: str, params: list) -> List[Dict]:
    return [dict(r) for r in db.execute(sql, params).fetchall()]


def _percentile(sorted_vals: List[float], pct: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = min(len(sorted_vals) - 1, max(0, int(round(pct * (len(sorted_vals) - 1)))))
    return round(sorted_vals[idx], 1)


# ---------------------------------------------------------------------------
# Insight queries
# ---------------------------------------------------------------------------

def overview(db: sqlite3.Connection, range_key: str, include_admins: bool) -> Dict:
    f = _Filter(db, range_key, include_admins)
    w_users_all, p_users_all = f.where(None, "id")
    w_signups, p_signups = f.where("created_at", "id")

    total_users = db.execute(f"SELECT COUNT(*) FROM users WHERE {w_users_all}", p_users_all).fetchone()[0]
    google_users = db.execute(
        f"SELECT COUNT(*) FROM users WHERE auth_provider = 'google' AND {w_users_all}", p_users_all).fetchone()[0]
    new_signups = db.execute(f"SELECT COUNT(*) FROM users WHERE created_at IS NOT NULL AND {w_signups}",
                             p_signups).fetchone()[0]

    def active_since(delta: timedelta) -> int:
        since = (datetime.now() - delta).isoformat()
        excl_sql, excl_p = "", []
        if f.excluded:
            excl_sql = f" AND uid NOT IN ({','.join('?' * len(f.excluded))})"
            excl_p = list(f.excluded)
        sql = f"""
            SELECT COUNT(DISTINCT uid) FROM (
                SELECT user_id AS uid FROM api_requests WHERE user_id IS NOT NULL AND ts >= ?
                UNION SELECT id AS uid FROM users WHERE last_login_at >= ?
            ) WHERE 1=1{excl_sql}
        """
        return db.execute(sql, [since, since] + excl_p).fetchone()[0]

    w_sess, p_sess = f.where("created_at", "user_id")
    sessions = db.execute(f"SELECT COUNT(*) FROM chat_sessions WHERE {w_sess}", p_sess).fetchone()[0]
    w_msg, p_msg = f.where("m.created_at", "s.user_id")
    messages = db.execute(
        f"SELECT COUNT(*) FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id WHERE m.role = 'user' AND {w_msg}",
        p_msg).fetchone()[0]
    w_saved, p_saved = f.where("created_at", "user_id")
    saves = db.execute(f"SELECT COUNT(*) FROM saved_properties WHERE created_at IS NOT NULL AND {w_saved}",
                       p_saved).fetchone()[0]
    w_req, p_req = f.where("ts", "user_id")
    req_row = db.execute(
        f"SELECT COUNT(*) AS total, SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS errors FROM api_requests WHERE {w_req}",
        p_req).fetchone()
    total_req = req_row["total"] or 0
    errors = req_row["errors"] or 0

    signups_series = _series(db, f"""
        SELECT substr(created_at, 1, {f.bucket}) AS bucket, COUNT(*) AS signups
        FROM users WHERE created_at IS NOT NULL AND {w_signups}
        GROUP BY bucket ORDER BY bucket
    """, p_signups)
    active_series = _series(db, f"""
        SELECT substr(ts, 1, {f.bucket}) AS bucket, COUNT(DISTINCT user_id) AS active_users
        FROM api_requests WHERE user_id IS NOT NULL AND {w_req}
        GROUP BY bucket ORDER BY bucket
    """, p_req)

    return {
        "range": f.range_key,
        "include_admins": include_admins,
        "total_users": total_users,
        "google_users": google_users,
        "legacy_users": total_users - google_users,
        "new_signups": new_signups,
        "dau": active_since(timedelta(days=1)),
        "wau": active_since(timedelta(days=7)),
        "chat_sessions": sessions,
        "user_messages": messages,
        "saves": saves,
        "requests": total_req,
        "error_rate": round(errors / total_req, 4) if total_req else 0.0,
        "signups_over_time": signups_series,
        "active_users_over_time": active_series,
    }


def list_users(db: sqlite3.Connection, include_admins: bool) -> List[Dict]:
    f = _Filter(db, "all", include_admins)
    w, p = f.where(None, "u.id")
    rows = db.execute(f"""
        SELECT u.id, u.username, u.email, u.avatar_url, u.auth_provider, u.created_at, u.last_login_at,
               (SELECT COUNT(*) FROM chat_sessions s WHERE s.user_id = u.id) AS session_count,
               (SELECT COUNT(*) FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
                  WHERE s.user_id = u.id AND m.role = 'user') AS message_count,
               (SELECT COUNT(*) FROM saved_properties sp WHERE sp.user_id = u.id) AS saved_count,
               (SELECT MAX(ts) FROM api_requests r WHERE r.user_id = u.id) AS last_request_at
        FROM users u WHERE {w}
    """, p).fetchall()
    users = []
    for r in rows:
        d = dict(r)
        d["is_admin"] = bool(d.get("email")) and d["email"].lower() in admin_emails()
        candidates = [x for x in (d.get("last_request_at"), d.get("last_login_at")) if x]
        d["last_active_at"] = max(candidates) if candidates else None
        users.append(d)
    users.sort(key=lambda u: u["last_active_at"] or "", reverse=True)
    return users


def user_detail(db: sqlite3.Connection, user_id: str) -> Optional[Dict]:
    row = db.execute(
        "SELECT id, username, email, avatar_url, auth_provider, created_at, last_login_at, workplace_hub, "
        "max_commute_mins, max_weekly_rent, min_bedrooms, has_pets, needs_parking, lifestyle_vibes, "
        "preferred_transit_modes, kai_verbosity FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return None
    profile = dict(row)
    profile["is_admin"] = bool(profile.get("email")) and profile["email"].lower() in admin_emails()
    saved = _series(db, """
        SELECT p.id, p.title, p.suburb, p.weekly_rent, p.bedrooms, sp.created_at AS saved_at
        FROM saved_properties sp JOIN properties p ON p.id = sp.property_id
        WHERE sp.user_id = ? ORDER BY sp.created_at DESC
    """, [user_id])
    sessions = _series(db, """
        SELECT s.id, s.title, s.created_at, s.updated_at,
               (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) AS message_count
        FROM chat_sessions s WHERE s.user_id = ? ORDER BY s.updated_at DESC
    """, [user_id])
    return {"profile": profile, "saved_properties": saved, "sessions": sessions}


def session_transcript(db: sqlite3.Connection, session_id: str, user_id: Optional[str] = None) -> Optional[Dict]:
    if user_id:
        sess = db.execute("SELECT id, title, created_at, updated_at FROM chat_sessions WHERE id = ? AND user_id = ?",
                          (session_id, user_id)).fetchone()
    else:
        sess = db.execute("SELECT id, title, created_at, updated_at FROM chat_sessions WHERE id = ?",
                          (session_id,)).fetchone()
    if not sess:
        return None
    messages = _series(db, "SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? "
                           "ORDER BY created_at ASC", [session_id])
    return {"session": dict(sess), "messages": messages}


def chats(db: sqlite3.Connection, range_key: str, include_admins: bool) -> Dict:
    f = _Filter(db, range_key, include_admins)
    w_s, p_s = f.where("created_at", "user_id")
    w_m, p_m = f.where("m.created_at", "s.user_id")
    sessions_series = _series(db, f"""
        SELECT substr(created_at, 1, {f.bucket}) AS bucket, COUNT(*) AS sessions
        FROM chat_sessions WHERE {w_s} GROUP BY bucket ORDER BY bucket
    """, p_s)
    messages_series = _series(db, f"""
        SELECT substr(m.created_at, 1, {f.bucket}) AS bucket,
               SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) AS user_messages,
               SUM(CASE WHEN m.role != 'user' THEN 1 ELSE 0 END) AS model_messages
        FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
        WHERE {w_m} GROUP BY bucket ORDER BY bucket
    """, p_m)
    most_active = _series(db, f"""
        SELECT u.id, u.username, u.email, u.avatar_url, COUNT(*) AS user_messages,
               COUNT(DISTINCT s.id) AS sessions
        FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id JOIN users u ON u.id = s.user_id
        WHERE m.role = 'user' AND {w_m}
        GROUP BY u.id ORDER BY user_messages DESC LIMIT 10
    """, p_m)
    recent = _series(db, f"""
        SELECT m.id, m.content, m.created_at, s.id AS session_id, s.title AS session_title,
               u.id AS user_id, u.username
        FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id LEFT JOIN users u ON u.id = s.user_id
        WHERE m.role = 'user' AND {w_m}
        ORDER BY m.created_at DESC LIMIT 25
    """, p_m)
    total_sessions = sum(r["sessions"] for r in sessions_series)
    total_user_msgs = sum(r["user_messages"] or 0 for r in messages_series)
    return {
        "range": f.range_key,
        "total_sessions": total_sessions,
        "total_user_messages": total_user_msgs,
        "avg_messages_per_session": round(total_user_msgs / total_sessions, 2) if total_sessions else 0.0,
        "sessions_over_time": sessions_series,
        "messages_over_time": messages_series,
        "most_active_users": most_active,
        "recent_prompts": recent,
    }


def saved(db: sqlite3.Connection, range_key: str, include_admins: bool) -> Dict:
    f = _Filter(db, range_key, include_admins)
    # Saves made before timestamps existed (created_at NULL) only appear in the all-time view.
    w, p = f.where("sp.created_at", "sp.user_id")
    top_properties = _series(db, f"""
        SELECT p.id, p.title, p.suburb, p.weekly_rent, p.bedrooms, COUNT(*) AS saves
        FROM saved_properties sp JOIN properties p ON p.id = sp.property_id
        WHERE {w} GROUP BY p.id ORDER BY saves DESC LIMIT 10
    """, p)
    top_suburbs = _series(db, f"""
        SELECT p.suburb, COUNT(*) AS saves, ROUND(AVG(p.weekly_rent), 0) AS avg_rent
        FROM saved_properties sp JOIN properties p ON p.id = sp.property_id
        WHERE {w} GROUP BY p.suburb ORDER BY saves DESC LIMIT 10
    """, p)
    series = _series(db, f"""
        SELECT substr(sp.created_at, 1, {f.bucket}) AS bucket, COUNT(*) AS saves
        FROM saved_properties sp WHERE sp.created_at IS NOT NULL AND {w}
        GROUP BY bucket ORDER BY bucket
    """, p)
    total = db.execute(f"SELECT COUNT(*) FROM saved_properties sp WHERE {w}", p).fetchone()[0]
    savers = db.execute(f"SELECT COUNT(DISTINCT sp.user_id) FROM saved_properties sp WHERE {w}", p).fetchone()[0]
    return {
        "range": f.range_key,
        "total_saves": total,
        "unique_savers": savers,
        "top_properties": top_properties,
        "top_suburbs": top_suburbs,
        "saves_over_time": series,
    }


def health(db: sqlite3.Connection, range_key: str, include_admins: bool) -> Dict:
    f = _Filter(db, range_key, include_admins)
    w, p = f.where("ts", "user_id")
    req_series = _series(db, f"""
        SELECT substr(ts, 1, {f.bucket}) AS bucket, COUNT(*) AS requests,
               SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS errors,
               SUM(CASE WHEN status >= 400 AND status < 500 THEN 1 ELSE 0 END) AS client_errors,
               ROUND(AVG(latency_ms), 1) AS avg_latency_ms
        FROM api_requests WHERE {w} GROUP BY bucket ORDER BY bucket
    """, p)

    per_endpoint: Dict[str, Dict] = {}
    for r in db.execute(f"SELECT method, path, status, latency_ms FROM api_requests WHERE {w}", p).fetchall():
        key = f"{r['method']} {r['path']}"
        e = per_endpoint.setdefault(key, {"endpoint": key, "requests": 0, "errors": 0, "latencies": []})
        e["requests"] += 1
        if r["status"] >= 500:
            e["errors"] += 1
        e["latencies"].append(r["latency_ms"])
    endpoints = []
    for e in per_endpoint.values():
        lat = sorted(e.pop("latencies"))
        e["p50_ms"] = _percentile(lat, 0.5)
        e["p95_ms"] = _percentile(lat, 0.95)
        e["error_rate"] = round(e["errors"] / e["requests"], 4) if e["requests"] else 0.0
        endpoints.append(e)
    endpoints.sort(key=lambda e: e["requests"], reverse=True)

    w_ext, p_ext = f.where("ts", None)
    external = _series(db, f"""
        SELECT service, COUNT(*) AS calls, SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures,
               ROUND(AVG(latency_ms), 1) AS avg_latency_ms,
               COALESCE(SUM(tokens_in), 0) AS tokens_in, COALESCE(SUM(tokens_out), 0) AS tokens_out
        FROM external_api_calls WHERE {w_ext} GROUP BY service ORDER BY calls DESC
    """, p_ext)
    external_series = _series(db, f"""
        SELECT substr(ts, 1, {f.bucket}) AS bucket, service, COUNT(*) AS calls
        FROM external_api_calls WHERE {w_ext} GROUP BY bucket, service ORDER BY bucket
    """, p_ext)
    recent_errors = _series(db, f"""
        SELECT ts, 'request' AS kind, method || ' ' || path AS source, CAST(status AS TEXT) AS detail
        FROM api_requests WHERE status >= 500 AND {w}
        UNION ALL
        SELECT ts, 'external' AS kind, service || ':' || operation AS source, COALESCE(error, 'failed') AS detail
        FROM external_api_calls WHERE success = 0 AND {w_ext}
        ORDER BY ts DESC LIMIT 20
    """, p + p_ext)

    total = sum(r["requests"] for r in req_series)
    errors = sum(r["errors"] or 0 for r in req_series)
    all_lat = sorted(r[0] for r in db.execute(f"SELECT latency_ms FROM api_requests WHERE {w}", p).fetchall())
    return {
        "range": f.range_key,
        "total_requests": total,
        "server_errors": errors,
        "error_rate": round(errors / total, 4) if total else 0.0,
        "p50_ms": _percentile(all_lat, 0.5),
        "p95_ms": _percentile(all_lat, 0.95),
        "requests_over_time": req_series,
        "endpoints": endpoints[:25],
        "external_services": external,
        "external_over_time": external_series,
        "recent_errors": recent_errors,
        "retention_days": LOG_RETENTION_DAYS,
    }
