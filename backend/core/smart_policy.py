"""Smart features policy — no inside AI — Engine 12/13."""

from __future__ import annotations

# OSS providers (client-side or translation proxy only — no LLM/AI).
SMART_TRANSLATION_PROVIDER = "libretranslate"  # https://github.com/LibreTranslate/LibreTranslate
SMART_SEARCH_PROVIDER = "minisearch"  # https://github.com/lucaong/minisearch
SMART_LANGUAGE_DETECT_PROVIDER = "franc"  # https://github.com/wooorm/franc

# SSC charter: no inside AI (no Ollama, no smart replies, no on-device LLM).
NO_INSIDE_AI = True

DISAPPEARING_MIN_SECONDS = 60
DISAPPEARING_MAX_SECONDS = 86_400
TYPING_TTL_SECONDS = 8


def validate_disappearing_seconds(seconds: int | None) -> tuple[bool, str]:
    if seconds is None:
        return True, ""
    if seconds < DISAPPEARING_MIN_SECONDS or seconds > DISAPPEARING_MAX_SECONDS:
        return False, "disappearing_seconds_out_of_range"
    return True, ""


def engine12_smart_ready() -> bool:
    return bool(SMART_SEARCH_PROVIDER) and NO_INSIDE_AI is True