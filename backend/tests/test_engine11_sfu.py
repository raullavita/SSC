"""SFU wiring tests — Engine 11."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from core.sfu_client import engine11_sfu_wired, provision_sfu_room
from core.sfu_policy import engine11_sfu_signaling_ready


@pytest.mark.asyncio
async def test_provision_sfu_room_success():
    mock_resp = AsyncMock()
    mock_resp.status_code = 201

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("core.sfu_client.httpx.AsyncClient", return_value=mock_client):
        ok, detail = await provision_sfu_room("ssc-room-abc", "token123")
    assert ok is True
    assert detail == "provisioned"


@pytest.mark.asyncio
async def test_provision_sfu_room_failure_status():
    mock_resp = AsyncMock()
    mock_resp.status_code = 500

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("core.sfu_client.httpx.AsyncClient", return_value=mock_client):
        ok, detail = await provision_sfu_room("ssc-room-abc", "token123")
    assert ok is False
    assert "sfu_status" in detail


def test_engine11_sfu_wired():
    assert engine11_sfu_wired() is True


def test_engine11_sfu_signaling_ready():
    from core.sfu_policy import engine11_sfu_signaling_ready

    assert engine11_sfu_signaling_ready() is True