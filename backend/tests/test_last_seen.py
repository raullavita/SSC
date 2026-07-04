"""Last-seen privacy tests — Engine 4."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from core.last_seen import coarse_last_seen, default_privacy_settings, last_seen_for_viewer
from tests.fake_mongo import FakeDatabase


def test_default_privacy_hides_last_seen():
    assert default_privacy_settings()["last_seen_visible"] is False


def test_coarse_buckets():
    now = datetime.now(timezone.utc)
    assert coarse_last_seen(now, True) == "online"
    assert coarse_last_seen(now - timedelta(hours=2), True) == "recently"
    assert coarse_last_seen(now - timedelta(days=3), True) == "away"
    assert coarse_last_seen(now, False) == "hidden"


@pytest.mark.asyncio
async def test_last_seen_hidden_when_not_visible():
    db = FakeDatabase()
    await db.users.insert_one(
        {
            "_id": "u_peer",
            "last_active": datetime.now(timezone.utc),
            "privacy_settings": {"last_seen_visible": False},
        }
    )
    out = await last_seen_for_viewer(db, "u_peer", "u_viewer")
    assert out["bucket"] == "hidden"
    assert out["visible"] is False