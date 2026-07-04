"""Smart features config — OSS provider registry — Engine 12."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from core.smart_policy import (
    DISAPPEARING_MAX_SECONDS,
    DISAPPEARING_MIN_SECONDS,
    OLLAMA_URL_HINT,
    SMART_LANGUAGE_DETECT_PROVIDER,
    SMART_LLM_PROVIDER,
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
        "local_search": True,
        "smart_replies": True,
        "auto_translate": True,
        "voice_messages": True,
        "disappearing_messages": True,
        "typing_indicators": True,
        "disappearing_range": {
            "min_seconds": DISAPPEARING_MIN_SECONDS,
            "max_seconds": DISAPPEARING_MAX_SECONDS,
        },
        "typing_ttl_seconds": TYPING_TTL_SECONDS,
        "ollama_url_hint": OLLAMA_URL_HINT,
        "providers": {
            "translation": SMART_TRANSLATION_PROVIDER,
            "search": SMART_SEARCH_PROVIDER,
            "language_detect": SMART_LANGUAGE_DETECT_PROVIDER,
            "llm": SMART_LLM_PROVIDER,
        },
        "privacy": "All smart processing runs on-device; Ollama is optional and local-only.",
    }