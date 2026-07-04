"""ID generation helpers."""

from __future__ import annotations

import secrets


def new_user_id() -> str:
    return f"u_{secrets.token_hex(8)}"


def new_conversation_id() -> str:
    return f"c_{secrets.token_hex(8)}"


def new_message_id() -> str:
    return f"m_{secrets.token_hex(10)}"


def direct_conversation_key(user_a: str, user_b: str) -> str:
    a, b = sorted([user_a, user_b])
    return f"direct:{a}:{b}"