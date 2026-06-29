"""Q.60 — Public status endpoint (health + incident notes)."""
from fastapi import APIRouter

from core.health_checks import full_health
from core.status_page_policy import build_public_status_payload
from core.utils import iso, now_utc

router = APIRouter()


@router.get("/status")
async def public_status():
    health = await full_health()
    return build_public_status_payload(health, updated_at=iso(now_utc()))