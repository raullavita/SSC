"""Authentication: JWT, passwords, Turnstile, current-user dependency."""
from datetime import datetime, timezone
from typing import Optional

import bcrypt
import jwt
import requests
from fastapi import Cookie, Header, HTTPException, Request

from core.config import JWT_SECRET, TURNSTILE_SECRET
from core.database import db
from core.logging_config import logger
from core.session_ttl import jwt_exp_timestamp, session_expires_at, session_ttl_seconds
from core.token_revocation import is_token_revoked, revoke_token
from core.utils import iso


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": jwt_exp_timestamp(now),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_jwt(token: str, *, check_revoked: bool = True) -> Optional[str]:
    if check_revoked and is_token_revoked(token):
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except Exception:
        return None


def jwt_ttl_seconds(token: str) -> int:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        exp = int(payload.get("exp", 0))
        ttl = exp - int(datetime.now(timezone.utc).timestamp())
        return max(ttl, 60)
    except Exception:
        return session_ttl_seconds()


async def store_user_session(user_id: str, token: str) -> None:
    expires = session_expires_at()
    await db.user_sessions.update_one(
        {"session_token": token},
        {"$set": {
            "user_id": user_id,
            "session_token": token,
            "expires_at": expires,
        }},
        upsert=True,
    )


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def is_installed_client_request(request) -> bool:
    """Installed APK/desktop — no Turnstile widget; captcha skipped."""
    return (request.headers.get("x-ssc-client") or "").strip().lower() == "installed"


def verify_turnstile(token: str, remote_ip: str, *, skip: bool = False) -> bool:
    from core.egress_policy import egress_feature_enabled

    if skip:
        return True
    if not egress_feature_enabled("turnstile"):
        return True
    if not TURNSTILE_SECRET:
        return True
    if not token:
        return False
    try:
        r = requests.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={"secret": TURNSTILE_SECRET, "response": token, "remoteip": remote_ip},
            timeout=10,
        )
        return bool(r.json().get("success"))
    except Exception as e:
        from core.logging_policy import safe_exception_label
        logger.warning(f"turnstile verify failed: {safe_exception_label(e)}")
        return False


def _public_user_projection() -> dict:
    return {
        "_id": 0,
        "password_hash": 0,
        "totp_secret": 0,
        "totp_pending_secret": 0,
        "recovery_encrypted_private_key": 0,
        "recovery_pk_salt": 0,
    }


def _finalize_current_user(user: dict) -> dict:
    from core.recovery_key_policy import sanitize_user_recovery_fields

    return sanitize_user_recovery_fields(user)


async def get_current_user(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
) -> dict:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if token:
        user_id = decode_jwt(token)
        if user_id:
            user = await db.users.find_one({"user_id": user_id}, _public_user_projection())
            if user:
                return _finalize_current_user(user)
    if session_token or token:
        st = session_token or token
        sess = await db.user_sessions.find_one({"session_token": st}, {"_id": 0})
        if sess:
            expires_at = sess.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at and expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one(
                    {"user_id": sess["user_id"]},
                    _public_user_projection(),
                )
                if user:
                    return _finalize_current_user(user)
    raise HTTPException(401, "Not authenticated")