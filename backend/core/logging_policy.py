"""Logging hygiene — Engine 1 Step 1.5. See memory/RETENTION_CHARTER.md §7."""
from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Optional
from urllib.parse import urlparse

# Mirror retention_policy.NEVER_LOG for grep audits
NEVER_LOG_FIELDS = (
    "ciphertext",
    "decrypted text",
    "encrypted_private_key",
    "password",
    "jwt",
    "totp_secret",
    "translation text",
    "file bytes",
    "invite token",
)

_JWT_PATTERN = re.compile(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")
_QUERY_SECRET_PATTERN = re.compile(
    r"([?&](?:auth|token|ticket|password|captcha_token)=)[^&\s\"']+",
    re.IGNORECASE,
)
_BEARER_PATTERN = re.compile(r"Bearer\s+[A-Za-z0-9._-]+", re.IGNORECASE)


def is_production() -> bool:
    return os.environ.get("ENV", "development").lower() == "production"


def format_client_ip(host: Optional[str]) -> str:
    if not host:
        return "unknown"
    if is_production():
        return "redacted"
    return host


def safe_request_path(path: str) -> str:
    """Log path only — never query strings (may carry JWT / invite tokens)."""
    return path.split("?")[0] if path else "/"


def token_log_ref(token: str) -> str:
    """Short opaque reference — correlates events without leaking the secret."""
    if not token:
        return "none"
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()[:8]
    return f"tok_{digest}"


def safe_redis_label(url: str) -> str:
    if not url:
        return "unset"
    try:
        parsed = urlparse(url)
        if parsed.password or "@" in url:
            host = parsed.hostname or "remote"
            port = f":{parsed.port}" if parsed.port else ""
            return f"redis://{host}{port}"
        return url.split("@")[-1]
    except Exception:
        return "redis"


def sanitize_log_message(message: str) -> str:
    if not message:
        return message
    msg = _JWT_PATTERN.sub("[JWT_REDACTED]", message)
    msg = _QUERY_SECRET_PATTERN.sub(r"\1[REDACTED]", msg)
    msg = _BEARER_PATTERN.sub("Bearer [REDACTED]", msg)
    return msg


def safe_exception_label(exc: BaseException) -> str:
    return type(exc).__name__


class SensitiveLogFilter(logging.Filter):
    """Redact secrets that accidentally reach log format strings."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = sanitize_log_message(record.msg)
        if record.args:
            record.args = tuple(
                sanitize_log_message(a) if isinstance(a, str) else a
                for a in record.args
            )
        return True


def attach_sensitive_log_filter(logger: logging.Logger) -> None:
    if not any(isinstance(f, SensitiveLogFilter) for f in logger.filters):
        logger.addFilter(SensitiveLogFilter())