"""Smart features policy — client-side intelligence with privacy — Engine 12."""

from __future__ import annotations

import os

# OSS providers wired in Engine 12 (client-side unless noted).
SMART_TRANSLATION_PROVIDER = "libretranslate"  # https://github.com/LibreTranslate/LibreTranslate
SMART_SEARCH_PROVIDER = "minisearch"  # https://github.com/lucaong/minisearch
SMART_LANGUAGE_DETECT_PROVIDER = "franc"  # https://github.com/wooorm/franc
SMART_LLM_PROVIDER = "ollama"  # https://github.com/ollama/ollama — local-only, never on SSC server

DISAPPEARING_MIN_SECONDS = 60
DISAPPEARING_MAX_SECONDS = 86_400
TYPING_TTL_SECONDS = 8

OLLAMA_URL_HINT = os.getenv("SSC_OLLAMA_URL_HINT", "http://localhost:11434")


def validate_disappearing_seconds(seconds: int | None) -> tuple[bool, str]:
    if seconds is None:
        return True, ""
    if seconds < DISAPPEARING_MIN_SECONDS or seconds > DISAPPEARING_MAX_SECONDS:
        return False, "disappearing_seconds_out_of_range"
    return True, ""


def engine12_smart_ready() -> bool:
    return bool(SMART_SEARCH_PROVIDER) and bool(SMART_LLM_PROVIDER)