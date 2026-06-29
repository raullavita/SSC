"""
Group call SFU policy — mesh limit + mediasoup integration (Q.35).

See memory/SFU_CHARTER.md.
"""
from __future__ import annotations

import os
from typing import Any, Dict

MESH_MAX_PARTICIPANTS = 8
SFU_MIN_PARTICIPANTS = MESH_MAX_PARTICIPANTS + 1
SELECTED_SFU_STACK = "mediasoup"
MEDIASOUP_VERSION = "3.14.4"


def group_calls_public_config() -> Dict[str, Any]:
    sfu_url = (os.environ.get("SFU_URL") or "").strip() or None
    sfu_enabled = (os.environ.get("SFU_ENABLED") or "").strip().lower() in ("1", "true", "yes")
    if sfu_url:
        sfu_enabled = True
    return {
        "mode": "sfu" if sfu_enabled else "mesh",
        "max_mesh_participants": MESH_MAX_PARTICIPANTS,
        "sfu_min_participants": SFU_MIN_PARTICIPANTS,
        "sfu_enabled": sfu_enabled,
        "sfu_url": sfu_url,
        "selected_stack": SELECTED_SFU_STACK,
        "mediasoup_version": MEDIASOUP_VERSION if sfu_enabled else None,
    }


def mesh_participant_cap() -> int:
    return MESH_MAX_PARTICIPANTS