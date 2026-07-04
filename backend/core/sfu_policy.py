"""SFU policy — mediasoup OSS for large group calls — Engine 9."""

from __future__ import annotations

import os
import secrets

from core.call_policy import MESH_MAX_PARTICIPANTS

# mediasoup — https://github.com/versatica/mediasoup (OSS SFU)
SFU_ENABLED = os.getenv("SSC_SFU_ENABLED", "false").lower() in ("1", "true", "yes")
SFU_WS_URL = os.getenv("SSC_SFU_WS_URL", "ws://localhost:4443")
SFU_ROOM_PREFIX = "ssc-room"

MAX_SFU_PARTICIPANTS = int(os.getenv("SSC_MAX_SFU_PARTICIPANTS", "50"))


def should_use_sfu(participant_count: int) -> bool:
    return SFU_ENABLED and participant_count > MESH_MAX_PARTICIPANTS


def new_sfu_room_id() -> str:
    return f"{SFU_ROOM_PREFIX}-{secrets.token_hex(8)}"


def sfu_room_token(room_id: str, user_id: str) -> str:
    return secrets.token_urlsafe(24)


def engine9_sfu_ready() -> bool:
    return bool(SFU_ROOM_PREFIX) and MAX_SFU_PARTICIPANTS > MESH_MAX_PARTICIPANTS


def engine11_sfu_signaling_ready() -> bool:
    """Engine 11 — mediasoup server signaling + backend provisioning wired."""
    from core.sfu_client import engine11_sfu_wired  # noqa: PLC0415

    return engine11_sfu_wired()