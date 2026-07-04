"""Push payload tests — Engine 4."""

from __future__ import annotations

import inspect

from core.push_payload import GENERIC_BODY, GENERIC_TITLE, build_generic_push
from push import send_generic_push_to_user


def test_build_generic_push_has_no_content_leak():
    payload = build_generic_push({"conversation_id": "c_1", "message_id": "m_1"})
    assert payload["title"] == GENERIC_TITLE
    assert payload["body"] == GENERIC_BODY
    assert "sender" not in payload["body"].lower()
    assert "ciphertext" not in str(payload).lower()
    assert payload["data"]["type"] == "generic_message"


def test_push_module_uses_build_generic_push():
    source = inspect.getsource(send_generic_push_to_user)
    assert "build_generic_push" in source