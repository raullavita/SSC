"""Translation policy — LibreTranslate OSS proxy — Engine 8."""

from __future__ import annotations

import os

# Self-hosted LibreTranslate default; override via env.
LIBRETRANSLATE_URL = os.getenv("LIBRETRANSLATE_URL", "").rstrip("/")

SUPPORTED_LANGUAGES: frozenset[str] = frozenset(
    {
        "en",
        "es",
        "fr",
        "de",
        "it",
        "pt",
        "ru",
        "zh",
        "ja",
        "ko",
        "ar",
        "hi",
        "nl",
        "pl",
        "tr",
        "uk",
        "vi",
        "th",
        "sv",
        "cs",
    }
)

MAX_TRANSLATION_CHARS = int(os.getenv("SSC_MAX_TRANSLATION_CHARS", "4000"))


def translation_enabled() -> bool:
    return bool(LIBRETRANSLATE_URL)


def engine8_translation_ready() -> bool:
    return translation_enabled() and bool(SUPPORTED_LANGUAGES)