import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from core.last_seen import project_peer_presence, project_user_for_peer
from core.privacy_settings import (
    DEFAULT_PRIVACY,
    filter_reads_for_viewer,
    merge_privacy,
    normalize_privacy_patch,
    privacy_from_user,
    privacy_public_config,
    read_receipts_enabled,
)
from routers.config_route import public_config


def test_privacy_defaults():
    assert privacy_from_user({}) == DEFAULT_PRIVACY
    assert read_receipts_enabled({"privacy": {"read_receipts": False}}) is False


def test_normalize_privacy_patch_rejects_invalid_last_seen():
    with pytest.raises(ValueError):
        normalize_privacy_patch({"last_seen": "precise"})


def test_merge_privacy_partial_update():
    merged = merge_privacy({"read_receipts": True}, {"typing_indicators": False})
    assert merged["read_receipts"] is True
    assert merged["typing_indicators"] is False
    assert merged["last_seen"] == "contacts"


def test_project_peer_presence_hidden():
    out = project_peer_presence("2026-06-28T12:00:00+00:00", visibility="hidden")
    assert out == {"online": False, "last_seen": None}


def test_project_user_hides_avatar_when_profile_photo_hidden():
    user = {
        "user_id": "u_1",
        "username": "alice",
        "avatar": "data:image/png;base64,abc",
        "last_seen": None,
        "privacy": {"profile_photo": "hidden"},
    }
    out = project_user_for_peer(user)
    assert out["avatar"] is None


def test_public_config_includes_privacy():
    data = asyncio.run(public_config())
    assert "privacy" in data
    assert data["privacy"]["defaults"]["read_receipts"] is True


@pytest.mark.asyncio
async def test_filter_reads_for_viewer_masks_disabled_users():
    reads = [
        {"user_id": "u_viewer", "last_read_message_id": "m1"},
        {"user_id": "u_peer", "last_read_message_id": "m2"},
    ]
    pmap = {
        "u_viewer": {**DEFAULT_PRIVACY, "read_receipts": False},
        "u_peer": {**DEFAULT_PRIVACY, "read_receipts": True},
    }
    with patch("core.privacy_settings.privacy_map_for_users", AsyncMock(return_value=pmap)):
        filtered = await filter_reads_for_viewer(reads, "u_viewer", ["u_viewer", "u_peer"])
    assert len(filtered) == 1
    assert filtered[0]["user_id"] == "u_viewer"