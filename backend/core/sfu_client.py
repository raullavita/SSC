"""HTTP client for SSC mediasoup SFU internal provisioning — Engine 11."""

from __future__ import annotations

import os

import httpx

SFU_INTERNAL_URL = os.getenv("SSC_SFU_INTERNAL_URL", "http://localhost:4443").rstrip("/")
SFU_INTERNAL_SECRET = os.getenv("SSC_SFU_INTERNAL_SECRET", "ssc-sfu-dev-secret")


async def provision_sfu_room(room_id: str, join_token: str) -> tuple[bool, str]:
    """Create mediasoup router on SFU server. Returns (ok, detail)."""
    if not SFU_INTERNAL_URL:
        return False, "sfu_internal_url_unset"

    headers = {"X-SSC-SFU-Secret": SFU_INTERNAL_SECRET}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{SFU_INTERNAL_URL}/internal/rooms",
                json={"room_id": room_id, "join_token": join_token},
                headers=headers,
            )
        if resp.status_code in (200, 201):
            return True, "provisioned"
        return False, f"sfu_status_{resp.status_code}"
    except httpx.HTTPError as exc:
        return False, f"sfu_unreachable:{exc.__class__.__name__}"


async def delete_sfu_room(room_id: str) -> tuple[bool, str]:
    if not SFU_INTERNAL_URL:
        return False, "sfu_internal_url_unset"

    headers = {"X-SSC-SFU-Secret": SFU_INTERNAL_SECRET}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.delete(
                f"{SFU_INTERNAL_URL}/internal/rooms/{room_id}",
                headers=headers,
            )
        if resp.status_code in (200, 404):
            return True, "deleted"
        return False, f"sfu_status_{resp.status_code}"
    except httpx.HTTPError as exc:
        return False, f"sfu_unreachable:{exc.__class__.__name__}"


def engine11_sfu_wired() -> bool:
    return bool(SFU_INTERNAL_URL) and bool(SFU_INTERNAL_SECRET)