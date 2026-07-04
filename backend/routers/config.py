"""Public configuration endpoint — requires installed client (Engine 2)."""

from __future__ import annotations

from fastapi import APIRouter

from core.firebase_init import firebase_ready
from core.sfu_policy import SFU_ENABLED, SFU_WS_URL

router = APIRouter(tags=["config"])


@router.get("/config")
async def public_config() -> dict:
    return {
        "app_name": "SSC - Super Secure Chat",
        "installed_client_required": True,
        "signal_lib_target": "0.96.4",
        "message_protocol": "signal_v1",
        "translation_provider": "libretranslate",
        "webrtc_mesh_max": 8,
        "min_ttl_hours": 24,
        "metadata_policy_version": "engine4-v1",
        "push_generic_only": True,
        "push_provider": "fcm",
        "push_ready": firebase_ready(),
        "sfu_enabled": SFU_ENABLED,
        "sfu_ws_url": SFU_WS_URL if SFU_ENABLED else None,
        "last_seen_default": "hidden",
        "engine": "10",
        "production_api": "api.supersecurechat.com",
        "production_web": "www.supersecurechat.com",
        "sealed_sender": True,
        "sealed_sender_default": True,
        "multi_device": True,
        "group_chat": True,
        "sfu_provider": "mediasoup",
    }


@router.get("/status")
async def public_status() -> dict:
    return {"status": "operational", "installed_only": True}