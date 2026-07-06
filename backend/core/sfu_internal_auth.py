"""SFU internal request signing — HMAC + nonce (Phase 3)."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time

SFU_INTERNAL_SECRET = os.getenv("SSC_SFU_INTERNAL_SECRET", "ssc-sfu-dev-secret")


def sfu_hmac_required() -> bool:
    raw = os.getenv("SSC_SFU_REQUIRE_HMAC", "true").strip().lower()
    return raw in ("1", "true", "yes", "on")


def sign_sfu_request(method: str, path: str, body: bytes) -> dict[str, str]:
    ts = str(int(time.time()))
    nonce = secrets.token_hex(12)
    canonical = f"{ts}\n{nonce}\n{method.upper()}\n{path}\n".encode() + body
    signature = hmac.new(
        SFU_INTERNAL_SECRET.encode(),
        canonical,
        hashlib.sha256,
    ).hexdigest()
    headers = {
        "X-SSC-SFU-Secret": SFU_INTERNAL_SECRET,
        "X-SSC-SFU-Timestamp": ts,
        "X-SSC-SFU-Nonce": nonce,
        "X-SSC-SFU-Signature": signature,
    }
    return headers


def verify_sfu_request(
    method: str,
    path: str,
    body: bytes,
    headers: dict[str, str],
    *,
    secret: str,
    max_skew_sec: int = 120,
) -> bool:
    if headers.get("x-ssc-sfu-secret") != secret and headers.get("X-SSC-SFU-Secret") != secret:
        # Allow legacy secret-only auth when HMAC not required
        legacy = headers.get("x-ssc-sfu-secret") or headers.get("X-SSC-SFU-Secret")
        if legacy == secret and not sfu_hmac_required():
            return True
        return False

    ts_raw = headers.get("x-ssc-sfu-timestamp") or headers.get("X-SSC-SFU-Timestamp")
    nonce = headers.get("x-ssc-sfu-nonce") or headers.get("X-SSC-SFU-Nonce")
    sig = headers.get("x-ssc-sfu-signature") or headers.get("X-SSC-SFU-Signature")
    if not ts_raw or not nonce or not sig:
        return not sfu_hmac_required()

    try:
        ts = int(ts_raw)
    except ValueError:
        return False
    if abs(int(time.time()) - ts) > max_skew_sec:
        return False

    canonical = f"{ts_raw}\n{nonce}\n{method.upper()}\n{path}\n".encode() + body
    expected = hmac.new(secret.encode(), canonical, hashlib.sha256).hexdigest()
    return secrets.compare_digest(expected, sig)