"""Profile bio policy — Q.38 optional about text on user profile."""
from __future__ import annotations

import re
from typing import Optional

BIO_MAX_LEN = 280
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


def normalize_bio(raw: Optional[str]) -> Optional[str]:
    """Trim and validate; empty string clears the bio. Preserves single newlines."""
    if raw is None:
        return None
    text = str(raw).replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return None
    if _CONTROL_RE.search(text):
        raise ValueError("Bio contains invalid characters")
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    if not text:
        return None
    if len(text) > BIO_MAX_LEN:
        raise ValueError(f"Bio too long (max {BIO_MAX_LEN} characters)")
    return text