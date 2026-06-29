"""Smoke tests for account recovery key routes — Q.41."""
from fastapi.testclient import TestClient

from server import app

client = TestClient(app)


def test_recovery_status_requires_auth():
    r = client.get("/api/auth/recovery/status")
    assert r.status_code == 401


def test_recovery_setup_requires_auth():
    r = client.post(
        "/api/auth/recovery/setup",
        json={
            "password": "testpass123",
            "recovery_encrypted_private_key": "x" * 32,
            "recovery_pk_salt": "c2FsdA==",
            "recovery_codes": ["ABCD1234"] * 10,
        },
    )
    assert r.status_code == 401


def test_recovery_regenerate_requires_auth():
    r = client.post(
        "/api/auth/recovery/regenerate",
        json={
            "password": "testpass123",
            "recovery_encrypted_private_key": "x" * 32,
            "recovery_pk_salt": "c2FsdA==",
            "recovery_codes": ["ABCD1234"] * 10,
        },
    )
    assert r.status_code == 401