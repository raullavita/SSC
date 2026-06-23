"""Third-party egress map — Engine 1 Step 1.6. See memory/RETENTION_CHARTER.md §6."""
from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

# Stable ids — used by /api/config, tests, and retention_policy.THIRD_PARTY_EGRESS
EGRESS_IDS = (
    "translation",
    "google_oauth",
    "fcm",
    "web_push",
    "turn_stun",
    "mongo_remote",
    "turnstile",
)

EGRESS_CATALOG: Dict[str, Dict[str, Any]] = {
    "translation": {
        "service": "MyMemory / Google Translate",
        "trigger": "POST /api/translate",
        "data_sent": "plaintext message text",
        "remote_hosts": ["api.mymemory.translated.net", "translation.googleapis.com"],
        "engine1_step": "1.2",
    },
    "google_oauth": {
        "service": "Google OAuth",
        "trigger": "Google login",
        "data_sent": "email, OAuth tokens",
        "remote_hosts": ["accounts.google.com", "oauth2.googleapis.com"],
        "engine1_step": "1.6",
    },
    "fcm": {
        "service": "Google FCM / Apple APNs (Firebase)",
        "trigger": "native push",
        "data_sent": "device token, notification payload",
        "remote_hosts": ["fcm.googleapis.com"],
        "engine1_step": "1.6",
    },
    "web_push": {
        "service": "Web Push (browser push services)",
        "trigger": "PWA push",
        "data_sent": "push endpoint URL, notification payload",
        "remote_hosts": ["fcm.googleapis.com", "updates.push.services.mozilla.com"],
        "engine1_step": "1.6",
    },
    "turn_stun": {
        "service": "STUN/TURN (WebRTC)",
        "trigger": "WebRTC calls",
        "data_sent": "IPs, call signaling metadata",
        "remote_hosts": ["stun.l.google.com", "global.relay.metered.ca"],
        "engine1_step": "1.6",
    },
    "mongo_remote": {
        "service": "MongoDB Atlas / remote Mongo",
        "trigger": "all database reads/writes",
        "data_sent": "all Tier A–F data when hosted remotely",
        "remote_hosts": ["*.mongodb.net"],
        "engine1_step": "1.6",
    },
    "turnstile": {
        "service": "Cloudflare Turnstile",
        "trigger": "register/login captcha",
        "data_sent": "captcha token, client IP",
        "remote_hosts": ["challenges.cloudflare.com"],
        "engine1_step": "1.6",
    },
}

_ATLAS_HOST_RE = re.compile(r"\.mongodb\.net\b", re.IGNORECASE)
_METERED_TURN_HOSTS = ("global.relay.metered.ca", "stun.relay.metered.ca")
_GOOGLE_STUN_HOSTS = ("stun.l.google.com", "stun1.l.google.com", "stun2.l.google.com")


def is_air_gapped_mode() -> bool:
    return os.environ.get("SSC_AIR_GAPPED_MODE", "false").lower() == "true"


def is_air_gapped_strict() -> bool:
    """When true with air-gap on, startup fails if third-party egress is still enabled."""
    return os.environ.get("SSC_AIR_GAPPED_STRICT", "false").lower() == "true"


def _env_truthy(key: str, default: str = "false") -> bool:
    return os.environ.get(key, default).lower() == "true"


def _split_urls(raw: str) -> List[str]:
    return [u.strip() for u in (raw or "").split(",") if u.strip()]


def is_mongo_remote() -> bool:
    url = (os.environ.get("MONGO_URL") or "").strip()
    if not url:
        return False
    if url.startswith("mongodb+srv://"):
        return True
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        host = url
    return bool(_ATLAS_HOST_RE.search(host))


def _translation_wants_on() -> bool:
    if not _env_truthy("TRANSLATION_ENABLED"):
        return False
    provider = (os.environ.get("TRANSLATION_PROVIDER") or "mymemory").lower().strip()
    return provider != "none"


def _firebase_configured() -> bool:
    return bool(
        (os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or "").strip()
        or (os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip()
    )


def _google_oauth_env_set() -> bool:
    return bool(
        (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
        and (os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()
        and (os.environ.get("GOOGLE_REDIRECT_URI") or "").strip()
    )


def _turn_credentials_set() -> bool:
    return bool(
        (os.environ.get("TURN_USERNAME") or "").strip()
        and (os.environ.get("TURN_CREDENTIAL") or "").strip()
    )


def _self_hosted_ice_configured() -> bool:
    return bool(_split_urls(os.environ.get("SSC_STUN_URLS", ""))) or bool(
        _split_urls(os.environ.get("SSC_TURN_URLS", ""))
    )


def _third_party_ice_would_be_used() -> bool:
    """True when third-party STUN/TURN hosts would be exposed to clients."""
    if is_air_gapped_mode():
        return False
    return True  # Google STUN fallback, or metered.ca when TURN creds set


def is_service_enabled(service_id: str) -> bool:
    """Whether this egress path is active with current env (ignores air-gap block)."""
    if service_id == "translation":
        return _translation_wants_on()
    if service_id == "google_oauth":
        return _google_oauth_env_set()
    if service_id == "fcm":
        return _firebase_configured()
    if service_id == "web_push":
        return bool((os.environ.get("VAPID_PRIVATE") or "").strip())
    if service_id == "turn_stun":
        return _third_party_ice_would_be_used()
    if service_id == "mongo_remote":
        return is_mongo_remote()
    if service_id == "turnstile":
        return bool((os.environ.get("TURNSTILE_SECRET") or "").strip())
    raise KeyError(f"unknown egress service: {service_id}")


def egress_feature_enabled(service_id: str) -> bool:
    """Runtime gate — False when air-gapped or service not configured."""
    if is_air_gapped_mode():
        return False
    return is_service_enabled(service_id)


def air_gap_violations() -> List[str]:
    """Egress ids that are enabled while SSC_AIR_GAPPED_MODE=true."""
    if not is_air_gapped_mode():
        return []
    return [sid for sid in EGRESS_IDS if is_service_enabled(sid)]


def build_ice_servers() -> List[Dict[str, str]]:
    """ICE server list for /api/config — no third-party hosts when air-gapped."""
    turn_user = (os.environ.get("TURN_USERNAME") or "").strip()
    turn_cred = (os.environ.get("TURN_CREDENTIAL") or "").strip()

    if is_air_gapped_mode():
        servers: List[Dict[str, str]] = []
        for url in _split_urls(os.environ.get("SSC_STUN_URLS", "")):
            servers.append({"urls": url})
        for url in _split_urls(os.environ.get("SSC_TURN_URLS", "")):
            entry: Dict[str, str] = {"urls": url}
            if turn_user and turn_cred:
                entry["username"] = turn_user
                entry["credential"] = turn_cred
            servers.append(entry)
        return servers

    if turn_user and turn_cred:
        return [
            {"urls": "stun:stun.relay.metered.ca:80"},
            {"urls": "turn:global.relay.metered.ca:80", "username": turn_user, "credential": turn_cred},
            {"urls": "turn:global.relay.metered.ca:80?transport=tcp", "username": turn_user, "credential": turn_cred},
            {"urls": "turn:global.relay.metered.ca:443", "username": turn_user, "credential": turn_cred},
            {"urls": "turns:global.relay.metered.ca:443?transport=tcp", "username": turn_user, "credential": turn_cred},
        ]

    return [{"urls": f"stun:{host}:19302"} for host in _GOOGLE_STUN_HOSTS]


def egress_status_entry(service_id: str) -> Dict[str, Any]:
    meta = EGRESS_CATALOG[service_id]
    enabled = is_service_enabled(service_id)
    blocked = is_air_gapped_mode() and enabled
    return {
        "id": service_id,
        "service": meta["service"],
        "trigger": meta["trigger"],
        "data_sent": meta["data_sent"],
        "remote_hosts": meta["remote_hosts"],
        "enabled": enabled,
        "allowed": egress_feature_enabled(service_id) if service_id != "mongo_remote" else not (
            is_air_gapped_mode() and enabled
        ),
        "blocked_by_air_gap": blocked,
        "engine1_step": meta["engine1_step"],
    }


def egress_status_map() -> Dict[str, Any]:
    violations = air_gap_violations()
    entries = [egress_status_entry(sid) for sid in EGRESS_IDS]
    return {
        "air_gapped_mode": is_air_gapped_mode(),
        "air_gap_compliant": len(violations) == 0,
        "air_gap_violations": violations,
        "third_party_egress": entries,
    }


def validate_air_gap_at_startup(logger) -> None:
    """Log air-gap posture at startup; strict mode raises on violations."""
    if not is_air_gapped_mode():
        active = [sid for sid in EGRESS_IDS if is_service_enabled(sid)]
        if active:
            logger.info(
                f"Third-party egress active: {', '.join(active)} "
                "(set SSC_AIR_GAPPED_MODE=true to block)"
            )
        return

    logger.info("Air-gapped mode ON — third-party egress blocked at runtime")
    violations = air_gap_violations()
    for sid in violations:
        svc = EGRESS_CATALOG[sid]["service"]
        logger.warning(
            f"Air-gap violation: {sid} ({svc}) is configured but will be blocked. "
            f"Unset related env vars or disable SSC_AIR_GAPPED_MODE."
        )
    if is_mongo_remote():
        logger.warning(
            "Air-gap: MONGO_URL points to remote/Atlas host — data leaves your metal. "
            "Use local MongoDB on your hardware."
        )
    if is_air_gapped_strict() and violations:
        raise RuntimeError(
            f"SSC_AIR_GAPPED_STRICT: disable third-party egress env vars: {', '.join(violations)}"
        )