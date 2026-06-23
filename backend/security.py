"""
Security helpers extracted for organization (high priority refactor - safe incremental).
"""
import os
import time
import logging
from collections import defaultdict, deque
from typing import Dict, Any

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
        logger.warning(
            f"REDIS_URL set but connection failed: {safe_exception_label(e)} "
            "— falling back to in-memory rate limits"
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

def rate_limit_check(key: str, max_hits: int, window_sec: int) -> bool:
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
            logger.warning(f"rate limit hit for key={key}")
            return False
        return True
    # in memory
    now = time.time()
    bucket = _rate_buckets[key]
    while bucket and now - bucket[0] > window_sec:
        bucket.popleft()
    if len(bucket) >= max_hits:
        logger.warning(f"rate limit hit for key={key}")
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

    env = os.environ.get("ENV", "development").lower()
    if env == "production":
        if not os.environ.get("REDIS_URL"):
            logger.warning("ENV=production but REDIS_URL unset — rate limits are per-worker only (use Redis for multi-worker)")
        cors = os.environ.get("CORS_ORIGINS", "")
        if "*" in cors:
            logger.warning("CORS_ORIGINS contains '*' in production — restrict to your frontend origin(s)")
        if len(jwt_secret) < 48:
            logger.warning("JWT_SECRET should be 48+ random characters in production")
        if not (os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")):
            logger.warning("ENV=production but Firebase not configured — Capacitor apps won't receive native push")
