"""Engine 8.3 — prekey bundle validation and route wiring."""
import base64
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.prekey_bundle import PrekeyValidationError, public_bundle_response, sanitize_bundle_payload
from core.signal_policy import LIBSIGNAL_PINNED_VERSION


def _key_b64() -> str:
    return base64.b64encode(b"\x05" + b"k" * 32).decode()


def _sig_b64() -> str:
    return base64.b64encode(b"s" * 64).decode()


def _kyber_b64() -> str:
    return base64.b64encode(b"\x08" + b"k" * 200).decode()


def _valid_payload():
    return {
        "registration_id": 12345,
        "device_id": 1,
        "identity_key_public": _key_b64(),
        "signed_prekey_id": 1,
        "signed_prekey_public": _key_b64(),
        "signed_prekey_signature": _sig_b64(),
        "kyber_prekey_id": 1,
        "kyber_prekey_public": _kyber_b64(),
        "kyber_prekey_signature": _sig_b64(),
        "one_time_prekeys": [{"prekey_id": 10, "public": _key_b64()}],
        "libsignal_version": LIBSIGNAL_PINNED_VERSION,
    }


def test_sanitize_valid_bundle():
    doc = sanitize_bundle_payload(_valid_payload())
    assert doc["registration_id"] == 12345
    assert len(doc["one_time_prekeys"]) == 1


def test_reject_secret_fields():
    payload = _valid_payload()
    payload["identity_key_private"] = _key_b64()
    with pytest.raises(PrekeyValidationError, match="forbidden"):
        sanitize_bundle_payload(payload)


def test_reject_bad_registration_id():
    payload = _valid_payload()
    payload["registration_id"] = 0
    with pytest.raises(PrekeyValidationError):
        sanitize_bundle_payload(payload)


def test_public_bundle_response_strips_internal_fields():
    doc = sanitize_bundle_payload(_valid_payload())
    doc["user_id"] = "u1"
    doc["updated_at"] = "now"
    out = public_bundle_response(doc, "u1")
    assert out["user_id"] == "u1"
    assert "updated_at" not in out
    assert len(out["one_time_prekeys"]) == 1


def test_keys_router_registered():
    from server import app

    paths = set()
    for route in app.routes:
        if hasattr(route, "routes"):
            for r in route.routes:
                if hasattr(r, "path"):
                    paths.add(r.path)
        elif hasattr(route, "path"):
            paths.add(route.path)
    assert "/api/keys/prekey-bundle" in paths or any("prekey-bundle" in p for p in paths)


def test_config_exposes_signal_version():
    from fastapi.testclient import TestClient
    from server import app

    client = TestClient(app)
    r = client.get("/api/config")
    assert r.status_code == 200
    signal = r.json().get("signal", {})
    assert signal.get("pinned_version") == LIBSIGNAL_PINNED_VERSION
    assert signal.get("prekey_api") is True


@pytest.mark.asyncio
async def test_upload_prekey_bundle_handler():
    from routers.keys import upload_prekey_bundle
    from core.models import PrekeyBundleIn

    body = PrekeyBundleIn(**_valid_payload())
    current = {"user_id": "user-test-1"}

    mock_coll = MagicMock()
    mock_coll.find_one = AsyncMock(return_value=None)
    mock_coll.insert_one = AsyncMock()
    mock_users = MagicMock()
    mock_users.update_one = AsyncMock()

    with patch("routers.keys.db") as mock_db:
        mock_db.signal_prekey_bundles = mock_coll
        mock_db.users = mock_users
        with patch("routers.keys.rate_limit_check", return_value=True), patch(
            "routers.keys.migrate_legacy_single_device", new_callable=AsyncMock
        ), patch("routers.keys.ensure_primary_device", new_callable=AsyncMock), patch(
            "routers.keys.touch_device", new_callable=AsyncMock
        ):
            result = await upload_prekey_bundle(body, current=current)

    assert result["status"] == "ok"
    mock_coll.insert_one.assert_called_once()
    mock_users.update_one.assert_called_once()