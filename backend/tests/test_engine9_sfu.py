"""SFU policy tests — Engine 9."""

from __future__ import annotations

from core.sfu_policy import (
    MESH_MAX_PARTICIPANTS,
    engine9_sfu_ready,
    should_use_sfu,
)


def test_mesh_cap_constant():
    assert MESH_MAX_PARTICIPANTS == 8


def test_should_use_sfu_when_disabled():
    assert should_use_sfu(20) is False


def test_engine9_sfu_ready():
    assert engine9_sfu_ready() is True