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
