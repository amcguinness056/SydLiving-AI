"""Authentication helpers: Google ID token verification, JWT sessions, and admin gating.

Flow:
  1. The frontend obtains a Google ID token (credential) via Google Identity Services.
  2. POST /api/auth/google verifies it server-side against GOOGLE_CLIENT_ID.
  3. The backend issues its own HS256 session JWT (7 day expiry) that the client
     sends as `Authorization: Bearer <token>` on subsequent requests.
  4. Admin endpoints additionally require the verified email to be in ADMIN_EMAILS.
"""
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException

# Matches the default client ID used by the frontend (frontend/src/components/AuthModal.tsx).
DEFAULT_GOOGLE_CLIENT_ID = "752861145108-ql61rl87or43s9pg5la1j7s54f8rcinu.apps.googleusercontent.com"
DEFAULT_ADMIN_EMAILS = "aaron.manu.td24@gmail.com"
JWT_ALGORITHM = "HS256"
SESSION_TTL = timedelta(days=7)

_ephemeral_secret: Optional[str] = None


def _jwt_secret() -> str:
    """Return the JWT signing secret. Falls back to a per-process random secret (dev only)."""
    global _ephemeral_secret
    secret = os.environ.get("JWT_SECRET")
    if secret:
        return secret
    if _ephemeral_secret is None:
        _ephemeral_secret = secrets.token_urlsafe(48)
        print("[Auth] WARNING: JWT_SECRET not set. Using an ephemeral secret; sessions reset on restart.")
    return _ephemeral_secret


def google_client_id() -> str:
    return os.environ.get("GOOGLE_CLIENT_ID") or DEFAULT_GOOGLE_CLIENT_ID


def admin_emails() -> set:
    raw = os.environ.get("ADMIN_EMAILS", DEFAULT_ADMIN_EMAILS)
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def is_admin_email(email: Optional[str]) -> bool:
    return bool(email) and email.strip().lower() in admin_emails()


def verify_google_credential(credential: str) -> dict:
    """Verify a Google ID token and return its claims. Raises HTTPException(401) on failure."""
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    try:
        claims = id_token.verify_oauth2_token(credential, google_requests.Request(), google_client_id())
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google credential: {e}")

    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid Google token issuer")
    if not claims.get("email") or not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified")
    return claims


def create_session_token(user_id: str, email: Optional[str]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + SESSION_TTL).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_session_token(token: str) -> dict:
    return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        return None
    return parts[1].strip()


def peek_user_id(authorization: Optional[str]) -> Optional[str]:
    """Best-effort, non-raising user id extraction (used by request logging middleware)."""
    token = _extract_bearer(authorization)
    if not token:
        return None
    try:
        return decode_session_token(token).get("sub")
    except Exception:
        return None


def get_session_claims(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Return decoded session claims, None if no token, or raise 401 if the token is invalid/expired."""
    token = _extract_bearer(authorization)
    if not token:
        return None
    try:
        return decode_session_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token")


def get_current_user(claims: Optional[dict] = Depends(get_session_claims)) -> Optional[str]:
    """Optional auth: returns the authenticated user id, or None for anonymous requests."""
    return claims.get("sub") if claims else None


def require_user(user_id: Optional[str] = Depends(get_current_user)) -> str:
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


def require_admin(claims: Optional[dict] = Depends(get_session_claims)) -> dict:
    if not claims:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not is_admin_email(claims.get("email")):
        raise HTTPException(status_code=403, detail="Forbidden: admin access required")
    return claims
