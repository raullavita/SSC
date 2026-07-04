"""Public configuration endpoint — requires installed client (Engine 2)."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["config"])


@router.get("/config")
async def public_config() -> dict:
    return {
        "app_name": "SSC - Super Secure Chat",
        "installed_client_required": True,
        "signal_lib_target": "0.96.4",
        "min_ttl_hours": 24,
        "metadata_policy_version": "engine4-v1",
        "push_generic_only": True,
        "last_seen_default": "hidden",
    }


@router.get("/status")
async def public_status() -> dict:
    return {"status": "operational", "installed_only": True}