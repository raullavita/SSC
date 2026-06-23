"""Engine 1 Step 1.5 — logging hygiene."""
import logging
import os
from unittest.mock import patch

from core.logging_policy import (
    SensitiveLogFilter,
    format_client_ip,
    safe_redis_label,
    safe_request_path,
    sanitize_log_message,
    token_log_ref,
)


def test_format_client_ip_redacted_in_production():
    with patch.dict(os.environ, {"ENV": "production"}, clear=False):
        assert format_client_ip("192.168.1.10") == "redacted"


def test_format_client_ip_visible_in_development():
    with patch.dict(os.environ, {"ENV": "development"}, clear=False):
        assert format_client_ip("192.168.1.10") == "192.168.1.10"


def test_safe_request_path_strips_query():
    assert safe_request_path("/api/files/f1?auth=secretjwt") == "/api/files/f1"


def test_sanitize_log_message_redacts_jwt():
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1XzEyMyJ9.signature"
    out = sanitize_log_message(f"WS ?token={jwt}")
    assert jwt not in out
    assert "[JWT_REDACTED]" in out or "[REDACTED]" in out


def test_sanitize_log_message_redacts_query_auth():
    out = sanitize_log_message("GET /api/files/x?auth=abc123&other=1")
    assert "abc123" not in out
    assert "[REDACTED]" in out


def test_token_log_ref_opaque():
    a = token_log_ref("invite-secret-token-abc")
    b = token_log_ref("invite-secret-token-abc")
    c = token_log_ref("other-token")
    assert a == b
    assert a.startswith("tok_")
    assert a != c
    assert "invite-secret" not in a


def test_safe_redis_label_hides_password():
    url = "redis://:s3cret@myhost.example.com:6379/0"
    label = safe_redis_label(url)
    assert "s3cret" not in label
    assert "myhost.example.com" in label


def test_sensitive_log_filter_attached():
    log = logging.getLogger("ssc-test-filter")
    filt = SensitiveLogFilter()
    record = log.makeRecord("ssc", logging.INFO, "", 0, "token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig", (), None)
    filt.filter(record)
    assert "eyJ" not in record.msg


def test_middleware_source_uses_safe_helpers():
    from pathlib import Path
    text = (Path(__file__).resolve().parents[1] / "middleware.py").read_text(encoding="utf-8")
    assert "format_client_ip" in text
    assert "safe_request_path" in text
    assert "client={client}" in text
    assert 'f"client={request.client.host' not in text


def test_invites_source_no_raw_token_log():
    from pathlib import Path
    text = (Path(__file__).resolve().parents[1] / "routers" / "invites.py").read_text(encoding="utf-8")
    assert "token_log_ref" in text
    assert "invite used: {token}" not in text


def test_no_raw_exception_in_logger_calls():
    """Exception logs must use type name only — never {e} in logger f-strings."""
    from pathlib import Path
    import re

    backend = Path(__file__).resolve().parents[1]
    paths = list((backend / "core").rglob("*.py"))
    paths += list((backend / "routers").rglob("*.py"))
    paths += [p for p in backend.glob("*.py")]
    pattern = re.compile(r'logger\.(info|warning|error|debug)\([^)]*\{e\}')
    offenders = []
    for path in paths:
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if pattern.search(line):
                offenders.append(f"{path.relative_to(backend)}:{i}")
    assert offenders == [], f"raw exception in logs: {offenders}"