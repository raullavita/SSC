import asyncio

from core.retention import DEFAULT_RETENTION_HOURS
from routers.config_route import public_config


def test_public_config_reports_ephemeral_default():
    data = asyncio.run(public_config())

    assert data["retention"]["hours"] == DEFAULT_RETENTION_HOURS
    assert data["retention"]["ephemeral_default"] is True
    assert "24" in data["retention"]["summary"]


def test_public_config_exposes_gif_search_shape():
    data = asyncio.run(public_config())

    assert "gif_search" in data
    assert "tenor_api_key" in data["gif_search"]
    assert "provider" in data["gif_search"]


def test_public_config_exposes_group_limits():
    data = asyncio.run(public_config())

    assert data["groups"]["max_participants"] == 50


def test_public_config_exposes_broadcast_lists_limits():
    data = asyncio.run(public_config())

    assert data["broadcast_lists"]["max_lists"] == 20
    assert data["broadcast_lists"]["max_recipients"] == 50


def test_public_config_exposes_calls_turn_shape():
    data = asyncio.run(public_config())

    assert "calls" in data
    assert "turn_configured" in data["calls"]
    assert "relay_server_count" in data["calls"]
    assert data["calls"]["off_lan_proof_required"] is True
    assert isinstance(data["ice_servers"], list)
