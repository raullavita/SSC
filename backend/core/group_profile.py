"""Group photo + description — Q.26 (shared metadata for members)."""
from __future__ import annotations

import base64
import re
from typing import Optional

from fastapi import HTTPException

GROUP_DESCRIPTION_MAX = 280
_GROUP_PHOTO_MAX_BYTES = 512_000
_ALLOWED_PHOTO_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})


def normalize_group_description(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value).strip())
    if not text:
        return None
    if len(text) > GROUP_DESCRIPTION_MAX:
        raise HTTPException(400, f"Description must be at most {GROUP_DESCRIPTION_MAX} characters")
    return text


def validate_group_photo_bytes(data: bytes, content_type: str) -> str:
    if len(data) > _GROUP_PHOTO_MAX_BYTES:
        raise HTTPException(413, "Group photo too large (max 500KB)")
    if content_type not in _ALLOWED_PHOTO_TYPES:
        raise HTTPException(400, "Photo must be JPEG, PNG, or WebP")
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    raise HTTPException(400, "Invalid image file")


def encode_group_photo(data: bytes, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"