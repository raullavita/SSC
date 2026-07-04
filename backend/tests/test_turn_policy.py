"""TURN ICE server policy tests — Step 3."""

from __future__ import annotations

import core.turn_policy as tp


def test_turn_policy_ready_default():
    assert tp.turn_policy_ready() is True


def test_build_ice_servers_stun_only_when_turn_disabled(monkeypatch):
    monkeypatch.setattr(tp, "TURN_ENABLED", False)
    monkeypatch.setattr(tp, "TURN_SECRET", "")
    monkeypatch.setattr(tp, "TURN_URIS", [])
    result = tp.build_ice_servers("user-abc")
    assert result["turn_enabled"] is False
    assert len(result["ice_servers"]) >= 1
    assert all("credential" not in s for s in result["ice_servers"])


def test_turn_credentials_hmac(monkeypatch):
    monkeypatch.setattr(tp, "TURN_SECRET", "test-turn-secret")
    monkeypatch.setattr(tp, "TURN_TTL_SECONDS", 3600)
    user, password, expiry = tp.turn_credentials_for_user("user-xyz")
    assert user.endswith(":user-xyz")
    assert int(user.split(":")[0]) >= expiry - 3600
    assert password
    assert len(password) > 8


def test_build_ice_servers_includes_turn_when_enabled(monkeypatch):
    monkeypatch.setattr(tp, "TURN_ENABLED", True)
    monkeypatch.setattr(tp, "TURN_SECRET", "test-turn-secret")
    monkeypatch.setattr(tp, "TURN_URIS", ["turn:turn.example.com:3478?transport=udp"])
    monkeypatch.setattr(tp, "STUN_URIS", ["stun:stun.example.com:3478"])
    result = tp.build_ice_servers("user-turn")
    assert result["turn_enabled"] is True
    turn_entries = [s for s in result["ice_servers"] if "credential" in s]
    assert len(turn_entries) == 1
    assert turn_entries[0]["username"]
    assert turn_entries[0]["credential"]