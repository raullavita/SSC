"""ID generation helpers."""

from __future__ import annotations

import secrets


def new_user_id() -> str:
    return f"u_{secrets.token_hex(8)}"


def new_conversation_id() -> str:
    return f"c_{secrets.token_hex(8)}"


def new_message_id() -> str:
    return f"m_{secrets.token_hex(10)}"


def new_file_id() -> str:
    return f"f_{secrets.token_hex(10)}"


def new_call_id() -> str:
    return f"call_{secrets.token_hex(8)}"


def new_group_id() -> str:
    return f"g_{secrets.token_hex(8)}"


def new_link_token_id() -> str:
    return f"link_{secrets.token_hex(10)}"


def new_story_id() -> str:
    return f"story_{secrets.token_hex(8)}"


def new_reaction_id() -> str:
    return f"rx_{secrets.token_hex(10)}"


def new_friend_request_id() -> str:
    return f"fr_{secrets.token_hex(8)}"


def new_poll_id() -> str:
    return f"poll_{secrets.token_hex(8)}"


def direct_conversation_key(user_a: str, user_b: str) -> str:
    a, b = sorted([user_a, user_b])
    return f"direct:{a}:{b}"