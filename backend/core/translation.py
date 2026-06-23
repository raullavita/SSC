"""Translation providers: MyMemory (free) and optional Google Cloud Translate."""
import os
import re
import time
from typing import List, Optional, Tuple

import requests

from core.logging_config import logger

PROVIDER = (os.environ.get("TRANSLATION_PROVIDER") or "mymemory").lower().strip()
GOOGLE_API_KEY = (os.environ.get("GOOGLE_TRANSLATE_API_KEY") or "").strip()

MYMEMORY_MAX_CHARS = 480
GOOGLE_MAX_CHARS = 4500

_BAD_RESPONSE_PATTERNS = (
    re.compile(r"PLEASE SELECT TWO DISTINCT LANGUAGES", re.I),
    re.compile(r"MYMEMORY WARNING", re.I),
    re.compile(r"^AUTO_DETECT LANGUAGE NOT SUPPORTED", re.I),
)


def is_bad_translation(text: str) -> bool:
    if not text or not text.strip():
        return True
    return any(p.search(text) for p in _BAD_RESPONSE_PATTERNS)


def chunk_text(text: str, max_len: int = MYMEMORY_MAX_CHARS) -> List[str]:
    """Split long text for provider limits without breaking mid-word when possible."""
    if not text:
        return []
    if len(text) <= max_len:
        return [text]

    chunks: List[str] = []
    remaining = text
    while remaining:
        if len(remaining) <= max_len:
            chunks.append(remaining)
            break

        window = remaining[:max_len]
        split_at = -1
        min_split = max(32, max_len // 5)

        for sep in ("\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " "):
            idx = window.rfind(sep)
            if idx >= min_split:
                split_at = idx + len(sep)
                break

        if split_at <= 0:
            split_at = max_len

        chunks.append(remaining[:split_at])
        remaining = remaining[split_at:]

    return chunks


def _mymemory(text: str, target: str, source: Optional[str]) -> Optional[str]:
    src = (source or "autodetect").lower().strip()
    try:
        r = requests.get(
            "https://api.mymemory.translated.net/get",
            params={"q": text, "langpair": f"{src}|{target}"},
            timeout=12,
        )
        if r.status_code == 200:
            body = r.json()
            translated = body.get("responseData", {}).get("translatedText")
            if translated and not is_bad_translation(translated):
                if translated.lower() != text.lower():
                    return translated
    except Exception as e:
        logger.warning(f"MyMemory translate failed: {type(e).__name__}")
    return None


def _google(text: str, target: str, source: Optional[str]) -> Optional[str]:
    if not GOOGLE_API_KEY:
        logger.warning("TRANSLATION_PROVIDER=google but GOOGLE_TRANSLATE_API_KEY unset")
        return None
    try:
        r = requests.post(
            "https://translation.googleapis.com/language/translate/v2",
            params={"key": GOOGLE_API_KEY},
            json={
                "q": text,
                "target": target,
                "source": source or None,
                "format": "text",
            },
            timeout=15,
        )
        if r.status_code == 200:
            items = r.json().get("data", {}).get("translations", [])
            if items:
                translated = items[0].get("translatedText", "")
                if translated and not is_bad_translation(translated) and translated.lower() != text.lower():
                    return translated
        else:
            logger.warning(f"Google translate HTTP {r.status_code}")
    except Exception as e:
        logger.warning(f"Google translate failed: {type(e).__name__}")
    return None


def _translate_chunk(
    text: str,
    target: str,
    source: Optional[str],
    fn,
    *,
    retry_autodetect: bool,
) -> Optional[str]:
    result = fn(text, target, source)
    if result:
        return result
    if retry_autodetect and source and source.lower() != "autodetect":
        return fn(text, target, None)
    return None


def _translate_provider(
    text: str,
    target: str,
    source: Optional[str],
    provider_name: str,
) -> Optional[str]:
    fn = _google if provider_name == "google" else _mymemory
    max_len = GOOGLE_MAX_CHARS if provider_name == "google" else MYMEMORY_MAX_CHARS
    chunks = chunk_text(text, max_len=max_len)

    if len(chunks) == 1:
        return _translate_chunk(chunks[0], target, source, fn, retry_autodetect=provider_name == "mymemory")

    parts: List[str] = []
    for i, chunk in enumerate(chunks):
        if i > 0 and provider_name == "mymemory":
            time.sleep(0.25)
        translated = _translate_chunk(chunk, target, source, fn, retry_autodetect=provider_name == "mymemory")
        if translated:
            parts.append(translated)
        else:
            parts.append(chunk)

    joined = "".join(parts)
    if joined.lower() == text.lower():
        return None
    return joined


def translate_text(text: str, target_language: str, source_language: Optional[str] = None) -> Tuple[str, str, Optional[str]]:
    """
    Returns (translated_text, provider_used, note).
    Falls back through configured provider → MyMemory → original text.
    Long text is split into chunks per provider limits and reassembled.
    """
    target = target_language.lower().strip()
    if not text or not target:
        return text, "none", "missing text or target"
    if source_language and source_language.lower().strip() == target:
        return text, "none", "same language"

    providers: List[str] = []
    if PROVIDER == "google":
        providers = ["google", "mymemory"]
    elif PROVIDER == "none":
        return text, "none", "translation disabled by provider"
    else:
        providers = ["mymemory"]

    tried: List[str] = []
    for name in providers:
        tried.append(name)
        result = _translate_provider(text, target, source_language, name)
        if result:
            note = "chunked" if len(chunk_text(text, GOOGLE_MAX_CHARS if name == "google" else MYMEMORY_MAX_CHARS)) > 1 else None
            return result, name, note

    return text, tried[-1] if tried else PROVIDER, "translation service unavailable or same language"