import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from core.retention import DEFAULT_RETENTION_HOURS, expires_at_from_now
from core.user_retention import (
    ALLOWED_RETENTION_HOURS,
    effective_retention_hours,
    normalize_user_retention_hours,
    retention_public_config,
    user_retention_hours_from_doc,
)
from routers.config_route import public_config


def test_allowed_retention_values():
    assert ALLOWED_RETENTION_HOURS == (1, 2, 4, 8, 24, 168, 720)


def test_normalize_user_retention_hours_accepts_allowed_values():
    assert normalize_user_retention_hours(1) == 1
    assert normalize_user_retention_hours(720) == 720


def test_normalize_user_retention_hours_rejects_invalid():
    with pytest.raises(ValueError):
        normalize_user_retention_hours(6)
    with pytest.raises(ValueError):
        normalize_user_retention_hours("bad")


def test_user_retention_hours_from_doc_defaults():
    assert user_retention_hours_from_doc({}) == DEFAULT_RETENTION_HOURS
    assert user_retention_hours_from_doc({"retention_hours": 4}) == 4
    assert user_retention_hours_from_doc({"retention_hours": 99}) == DEFAULT_RETENTION_HOURS


def test_effective_retention_uses_shortest_participant_window():
    assert effective_retention_hours([24, 8, 168]) == 8
    assert effective_retention_hours([]) == DEFAULT_RETENTION_HOURS


def test_public_config_exposes_per_user_retention():
    data = asyncio.run(public_config())
    retention = data["retention"]
    assert retention["per_user"] is True
    assert retention["allowed_hours"] == list(ALLOWED_RETENTION_HOURS)
    assert retention["default_hours"] == DEFAULT_RETENTION_HOURS


@pytest.mark.asyncio
async def test_refresh_retention_after_user_change_shortens_messages():
    from core.retention_db import refresh_retention_after_user_change

    conv = {"conversation_id": "c_test", "participants": ["u_a", "u_b"]}

    with patch("core.retention_db.db") as mock_db:
        mock_db.conversations.find.return_value.to_list = AsyncMock(return_value=[conv])
        mock_db.users.find.return_value = _async_iter([{"retention_hours": 1}, {"retention_hours": 24}])
        mock_db.conversations.update_one = AsyncMock()
        mock_db.messages.update_many = AsyncMock()
        mock_db.message_reads.update_many = AsyncMock()

        await refresh_retention_after_user_change("u_a")

        mock_db.conversations.update_one.assert_called_once()
        mock_db.messages.update_many.assert_called_once()
        args, _kwargs = mock_db.messages.update_many.call_args
        assert args[0]["conversation_id"] == "c_test"
        assert "expires_at" in args[1]["$set"]


async def _async_iter(items):
    for item in items:
        yield item