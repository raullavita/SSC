"""LibreTranslate OSS proxy — Engine 8 free multilingual translation."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from config import get_settings
from core.translation_policy import (
    LIBRETRANSLATE_URL,
    MAX_TRANSLATION_CHARS,
    SUPPORTED_LANGUAGES,
)
from deps import get_client_header, get_current_user_id

router = APIRouter(prefix="/translation", tags=["translation"])


class TranslateBody(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TRANSLATION_CHARS)
    source: str = Field(default="auto", max_length=8)
    target: str = Field(min_length=2, max_length=8)


@router.get("/languages")
async def list_languages(
    _client: str = Depends(get_client_header),
    _user: str = Depends(get_current_user_id),
) -> dict:
    return {"languages": sorted(SUPPORTED_LANGUAGES), "provider": "libretranslate"}


@router.post("/translate")
async def translate_text(
    body: TranslateBody,
    _client: str = Depends(get_client_header),
    _user: str = Depends(get_current_user_id),
) -> dict:
    if body.target not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="unsupported_target_language")
    if body.source != "auto" and body.source not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="unsupported_source_language")
    if not LIBRETRANSLATE_URL:
        raise HTTPException(status_code=503, detail="translation_not_configured")

    settings = get_settings()
    api_key = settings.libretranslate_api_key
    payload = {
        "q": body.text,
        "source": body.source,
        "target": body.target,
        "format": "text",
    }
    if api_key:
        payload["api_key"] = api_key

    url = f"{LIBRETRANSLATE_URL}/translate"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, json=payload)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="translation_service_unavailable") from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"translation_failed:{response.status_code}",
        )

    data = response.json()
    return {
        "translated_text": data.get("translatedText", ""),
        "source": body.source,
        "target": body.target,
        "provider": "libretranslate",
    }