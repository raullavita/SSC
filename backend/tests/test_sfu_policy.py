"""SFU policy — group call mesh cap and config contract."""
from core.sfu_policy import (
    MESH_MAX_PARTICIPANTS,
    SELECTED_SFU_STACK,
    group_calls_public_config,
    mesh_participant_cap,
)


def test_mesh_cap_is_eight():
    assert mesh_participant_cap() == 8
    assert MESH_MAX_PARTICIPANTS == 8


def test_group_calls_config_mesh_by_default(monkeypatch):
    monkeypatch.delenv("SFU_URL", raising=False)
    monkeypatch.delenv("SFU_ENABLED", raising=False)
    cfg = group_calls_public_config()
    assert cfg["mode"] == "mesh"
    assert cfg["sfu_enabled"] is False
    assert cfg["sfu_url"] is None
    assert cfg["max_mesh_participants"] == 8
    assert cfg["selected_stack"] == SELECTED_SFU_STACK


def test_group_calls_config_sfu_when_url_set(monkeypatch):
    monkeypatch.setenv("SFU_URL", "wss://sfu.example.com")
    cfg = group_calls_public_config()
    assert cfg["sfu_enabled"] is True
    assert cfg["mode"] == "sfu"
    assert cfg["sfu_url"] == "wss://sfu.example.com"
    assert cfg["sfu_min_participants"] == 9
    assert cfg["mediasoup_version"] == "3.14.4"


def test_sfu_charter_exists():
    from pathlib import Path

    text = (Path(__file__).resolve().parents[2] / "memory" / "SFU_CHARTER.md").read_text(
        encoding="utf-8"
    )
    assert "mediasoup" in text
    assert "8" in text