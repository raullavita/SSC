"""Abuse telemetry counter tests."""

from __future__ import annotations

import base64

import pytest

from core.abuse_metrics import abuse_metrics_snapshot
from core.device_ciphertext_policy import validate_send_ciphertexts


VALID_CT = base64.b64encode(b"x" * 32).decode("ascii")


@pytest.mark.asyncio
async def test_auth_rate_limit_records_metric(client, monkeypatch):
    class _BlockLimiter:
        async def allow(self, _key: str) -> bool:
            return False

    monkeypatch.setattr("middleware.auth_rate_limiter", _BlockLimiter())

    resp = await client.post("/api/auth/login", json={"email": "x@example.com", "password": "bad"})
    assert resp.status_code == 429
    assert resp.json()["detail"] == "auth_rate_limited"

    health = await client.get("/api/health")
    assert health.status_code == 200
    counters = health.json()["abuse_metrics"]["rate_limits"]
    assert counters.get("auth", 0) >= 1


def test_device_ciphertext_rejection_records_metric(monkeypatch):
    monkeypatch.setattr("core.device_ciphertext_policy.MAX_DEVICE_CIPHERTEXT_TARGETS", 1)
    ok, detail = validate_send_ciphertexts(
        ciphertext=None,
        device_ciphertexts={"1": VALID_CT, "2": VALID_CT},
        protocol="signal_v1",
    )
    assert ok is False
    assert detail == "device_ciphertexts_too_many_targets"

    snap = abuse_metrics_snapshot()
    assert snap["rejections"].get("device_ciphertexts_too_many_targets", 0) >= 1
