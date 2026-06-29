"""
Security helpers extracted for organization (high priority refactor - safe incremental).
"""
import hashlib
import os
import time
import logging
from collections import defaultdict, deque
from typing import Dict, Any

from core.security_observability import security_event


def _rate_limit_key_label(key: str) -> str:
    """Opaque label for logs — never emit raw rate-limit bucket keys."""
    if not key:
        return "empty"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]

logger = logging.getLogger("ssc")

# Rate limiting (in-memory; per single worker) - moved from server.py
_rate_buckets: Dict[str, deque] = defaultdict(deque)

_redis = None
_redis_url = (os.environ.get("REDIS_URL") or "").strip()
try:
    import redis
    if _redis_url:
        _redis = redis.from_url(_redis_url, decode_responses=True)
        _redis.ping()
        from core.logging_policy import safe_redis_label
        logger.info(f"Rate limiting: Redis ({safe_redis_label(_redis_url)})")
except Exception as e:
    _redis = None
    if _redis_url:
        from core.logging_policy import safe_exception_label
        reason = safe_exception_label(e)
        logger.warning(
            f"REDIS_URL set but connection failed: {reason} "
            "— falling back to in-memory rate limits"
        )
        security_event(
            "redis_rate_limit_fallback",
            severity="warning",
            backend="memory",
            reason=reason,
        )


def get_rate_limit_backend() -> str:
    return "redis" if _redis else "memory"


def ping_redis() -> bool:
    if not _redis:
        return False
    try:
        return bool(_redis.ping())
    except Exception:
        return False

def rate_limit_check(
    key: str,
    max_hits: int,
    window_sec: int,
    *,
    limiter: str = "generic",
) -> bool:
    """Returns True if allowed, False if rate-limited.
    Uses Redis if REDIS_URL set, else in-memory.
    """
    if _redis:
        # Redis backed (namespaced for multi-app deployments)
        rkey = f"ssc:rl:{key}"
        pipe = _redis.pipeline()
        pipe.incr(rkey)
        pipe.expire(rkey, window_sec)
        count, _ = pipe.execute()
        if int(count) > max_hits:
            logger.warning(
                "rate-limit reject "
                f"limiter={limiter} backend=redis key={_rate_limit_key_label(key)} "
                f"hits={int(count)} max_hits={max_hits} window_sec={window_sec}"
            )
            return False
        return True
    # in memory
    now = time.time()
    bucket = _rate_buckets[key]
    while bucket and now - bucket[0] > window_sec:
        bucket.popleft()
    if len(bucket) >= max_hits:
        logger.warning(
            "rate-limit reject "
            f"limiter={limiter} backend=memory key={_rate_limit_key_label(key)} "
            f"hits={len(bucket)} max_hits={max_hits} window_sec={window_sec}"
        )
        return False
    bucket.append(now)
    return True

def validate_environment():
    """Fail fast with clear messages if critical env vars are missing.
    Assumes .env already loaded by caller.
    """
    required = ["MONGO_URL", "DB_NAME", "JWT_SECRET"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

    jwt_secret = os.environ.get("JWT_SECRET", "")
    if len(jwt_secret) < 32:
        logger.warning("JWT_SECRET is short — use at least 32 characters in production")

    turn_secret = os.environ.get("TURNSTILE_SECRET", "")
    if not turn_secret:
        logger.warning("TURNSTILE_SECRET not set — captcha disabled (development mode)")

    vapid_priv = os.environ.get("VAPID_PRIVATE", "")
    if not vapid_priv:
        logger.warning("VAPID_PRIVATE not set — web push notifications disabled")

    firebase_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    firebase_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if not firebase_json and not firebase_path:
        logger.warning("Firebase credentials not set — native FCM/APNs push disabled")

    turn_user = os.environ.get("TURN_USERNAME", "")
    turn_cred = os.environ.get("TURN_CREDENTIAL", "")
    if not (turn_user and turn_cred):
        logger.warning("TURN credentials not set — WebRTC calls may fail across networks")

    from core.translation_access import is_translation_allowed, translation_provider
    if is_translation_allowed():
        logger.warning(
            f"TRANSLATION_ENABLED=true — decrypted message text may be sent to "
            f"{translation_provider()} (E2E privacy tradeoff)"
        )
    else:
        logger.info("Server-side translation disabled (default — preserves E2E privacy)")

    from core.egress_policy import validate_air_gap_at_startup
    validate_air_gap_at_startup(logger)

    from core.session_production import validate_production_redis

    validate_production_redis(_redis, _redis_url)

    env = os.environ.get("ENV", "development").lower()
    db_name = (os.environ.get("DB_NAME") or "").strip()
    prod_db_names = frozenset({"ssc"})
    prod_jwt = (os.environ.get("SSC_PRODUCTION_JWT_SECRET") or "").strip()

    if env == "development":
        if db_name in prod_db_names:
            raise RuntimeError(
                "ENV=development must not use production DB_NAME=ssc — set DB_NAME=ssc-dev in backend/.env"
            )
        if prod_jwt and jwt_secret == prod_jwt:
            raise RuntimeError(
                "Local JWT_SECRET matches SSC_PRODUCTION_JWT_SECRET — use a distinct dev secret"
            )
        pepper = (os.environ.get("CONTACT_GRAPH_PEPPER") or "").strip()
        if not pepper or pepper == "ssc-dev-contact-graph-pepper":
            logger.warning(
                "CONTACT_GRAPH_PEPPER unset or dev default — set a strong pepper even for ssc-dev"
            )
    else:
        if not (os.environ.get("CONTACT_GRAPH_PEPPER") or "").strip():
            raise RuntimeError("CONTACT_GRAPH_PEPPER is required when ENV=production")

    if env == "production":
        cors = os.environ.get("CORS_ORIGINS", "")
        if "*" in cors:
            logger.warning("CORS_ORIGINS contains '*' in production — restrict to installed-app origins")
        browser_origins = [o for o in cors.split(",") if ":3000" in o or "127.0.0.1" in o]
        if browser_origins:
            raise RuntimeError(
                f"CORS_ORIGINS must not include browser dev origins in production: {browser_origins}"
            )
        if len(jwt_secret) < 48:
            logger.warning("JWT_SECRET should be 48+ random characters in production")
        if not (os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")):
            logger.warning("ENV=production but Firebase not configured — Capacitor apps won't receive native push")
