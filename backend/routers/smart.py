"""Smart features config — no inside AI — Engine 12/13."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from core.smart_policy import (
    DISAPPEARING_MAX_SECONDS,
    DISAPPEARING_MIN_SECONDS,
    NO_INSIDE_AI,
    SMART_LANGUAGE_DETECT_PROVIDER,
    SMART_SEARCH_PROVIDER,
    SMART_TRANSLATION_PROVIDER,
    TYPING_TTL_SECONDS,
)
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/smart", tags=["smart"])


@router.get("/config")
async def smart_config(
    _client: str = Depends(get_client_header),
    _user: str = Depends(get_current_user_id),
) -> dict:
    return {
        "no_inside_ai": NO_INSIDE_AI,
        "local_search": True,
        "auto_translate": True,
        "voice_messages": True,
        "disappearing_messages": True,
        "typing_indicators": True,
        "smart_replies": False,
        "disappearing_range": {
            "min_seconds": DISAPPEARING_MIN_SECONDS,
            "max_seconds": DISAPPEARING_MAX_SECONDS,
        },
        "typing_ttl_seconds": TYPING_TTL_SECONDS,
        "providers": {
            "translation": SMART_TRANSLATION_PROVIDER,
            "search": SMART_SEARCH_PROVIDER,
            "language_detect": SMART_LANGUAGE_DETECT_PROVIDER,
        },
        "privacy": "No inside AI. Search and language detect run on-device; translation uses LibreTranslate proxy.",
    }