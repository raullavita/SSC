"""Q.56 — security scan policy tests."""
from pathlib import Path

from core.security_scan_policy import (
    FORBIDDEN_PUBLIC_LEAKS,
    SECURITY_SCAN_REQUIREMENTS,
    SECURITY_SMOKE_SCRIPT,
    ZAP_RULES_PATH,
    ZAP_WORKFLOW_PATH,
    audit_public_payload,
    headers_include_security_baselines,
    is_unauthorized_status,
    response_leaks_secrets,
    security_scan_enabled,
)

REPO = Path(__file__).resolve().parents[2]


def test_security_scan_enabled():
    assert security_scan_enabled() is True


def test_forbidden_leaks_detected():
    assert "jwt_secret" in FORBIDDEN_PUBLIC_LEAKS
    found = response_leaks_secrets('{"error":"jwt_secret leaked"}')
    assert "jwt_secret" in found
    assert not response_leaks_secrets('{"status":"ok"}')


def test_security_headers_check():
    missing = headers_include_security_baselines({"Content-Type": "application/json"})
    assert "x-content-type-options" in missing
    ok = headers_include_security_baselines({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
    })
    assert not ok


def test_unauthorized_status_codes():
    assert is_unauthorized_status(401)
    assert is_unauthorized_status(403)
    assert not is_unauthorized_status(200)


def test_audit_public_payload_nested():
    leaks = audit_public_payload({"nested": {"totp_secret": "ABC"}})
    assert "totp_secret" in leaks


def test_requirements_documented():
    assert len(SECURITY_SCAN_REQUIREMENTS) >= 4


def test_zap_workflow_exists():
    assert (REPO / ZAP_WORKFLOW_PATH).is_file()


def test_zap_rules_exists():
    assert (REPO / ZAP_RULES_PATH).is_file()


def test_security_smoke_script_exists():
    assert (REPO / SECURITY_SMOKE_SCRIPT).is_file()