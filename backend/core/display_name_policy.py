"""Display name policy — Q.37 friendly label separate from locked username."""
from __future__ import annotations

import re
from typing import Optional

DISPLAY_NAME_MAX_LEN = 48
_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")


def normalize_display_name(raw: Optional[str]) -> Optional[str]:
    """Trim and validate; empty string clears the display name."""
    if raw is None:
        return None
    collapsed = " ".join(str(raw).split())
    if not collapsed:
        return None
    if len(collapsed) > DISPLAY_NAME_MAX_LEN:
        raise ValueError(f"Display name too long (max {DISPLAY_NAME_MAX_LEN} characters)")
    if "@" in collapsed:
        raise ValueError("Display name cannot contain @")
    if _CONTROL_RE.search(collapsed):
        raise ValueError("Display name contains invalid characters")
    return collapsed