"""Public client configuration (ICE, Turnstile, VAPID, egress map)."""
from fastapi import APIRouter

from core.config import ENV, TURNSTILE_SITEKEY, VAPID_PUBLIC
from core.egress_policy import build_ice_servers, egress_feature_enabled, egress_status_map, is_air_gapped_mode
from core.translation_access import is_translation_allowed, translation_provider
from security import get_rate_limit_backend

router = APIRouter()


@router.get("/config")
async def public_config():
    turnstile_key = TURNSTILE_SITEKEY if egress_feature_enabled("turnstile") else ""
    return {
        "turnstile_sitekey": turnstile_key,
        "vapid_public_key": VAPID_PUBLIC if egress_feature_enabled("web_push") else "",
        "app_name": "SSC",
        "version": "0.4-standalone",
        "env": ENV,
        "air_gapped_mode": is_air_gapped_mode(),
        "translation_enabled": is_translation_allowed(),
        "translation_provider": translation_provider(),
        "rate_limit_backend": get_rate_limit_backend(),
        "ice_servers": build_ice_servers(),
        "egress": egress_status_map(),
    }