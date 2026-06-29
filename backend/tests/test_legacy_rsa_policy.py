"""Q.54 — legacy RSA send retired on installed clients."""
import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock

from core.legacy_rsa_policy import (
    INSTALLED_LEGACY_RSA_SEND_RETIRED,
    reject_legacy_rsa_send_for_installed,
)
from core.signal_policy import ProtocolVersion


@pytest.fixture(autouse=True)
def _production_env(monkeypatch):
    monkeypatch.setenv("ENV", "production")


def _request(installed: bool):
    req = MagicMock()
    req.headers = {"x-ssc-client": "installed"} if installed else {}
    return req


def test_reject_legacy_rsa_from_installed_client():
    with pytest.raises(HTTPException) as exc:
        reject_legacy_rsa_send_for_installed(_request(True), ProtocolVersion.LEGACY_RSA.value)
    assert exc.value.status_code == 403
    assert "legacy_rsa_send_retired" in str(exc.value.detail)


def test_reject_legacy_rsa_from_browser():
    with pytest.raises(HTTPException) as exc:
        reject_legacy_rsa_send_for_installed(_request(False), ProtocolVersion.LEGACY_RSA.value)
    assert exc.value.status_code == 403
    assert "install the SSC app" in str(exc.value.detail)


def test_allow_signal_from_installed():
    reject_legacy_rsa_send_for_installed(_request(True), ProtocolVersion.SIGNAL_V1.value)


def test_policy_flag_enabled():
    assert INSTALLED_LEGACY_RSA_SEND_RETIRED is True


def test_development_env_allows_legacy_rsa_send(monkeypatch):
    monkeypatch.setenv("ENV", "development")
    reject_legacy_rsa_send_for_installed(_request(True), ProtocolVersion.LEGACY_RSA.value)