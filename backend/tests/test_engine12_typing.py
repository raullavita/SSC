"""Typing indicator tests — Engine 12."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from routers.typing import router, send_typing


def test_typing_router_registered():
    assert router is not None
    paths = [getattr(r, "path", "") for r in router.routes]
    assert any("typing" in p for p in paths)


@pytest.mark.asyncio
async def test_send_typing_publishes_ws():
    mock_db = AsyncMock()
    mock_db.conversations.find_one = AsyncMock(
        return_value={"_id": "c_test", "participants": ["u_a", "u_b"]}
    )

    with (
        patch("routers.typing.get_database", return_value=mock_db),
        patch("routers.typing.ws_hub.publish", new_callable=AsyncMock) as mock_publish,
    ):
        result = await send_typing("c_test", type("Body", (), {"active": True})(), "u_a", "electron/0.1.0/1")

    assert result == {"ok": True}
    mock_publish.assert_awaited_once()
    topic, payload = mock_publish.await_args[0]
    assert topic == "conversation:c_test"
    assert payload["type"] == "typing"
    assert payload["user_id"] == "u_a"
    assert payload["active"] is True