"""Production startup gates — fail fast before serving traffic (Phase 1)."""

from __future__ import annotations

import os

from config import Settings
from core.deploy_policy import production_env_valid

WEAK_JWT_SECRETS: frozenset[str] = frozenset(
    {
        "",
        "dev-only-change-me",
        "change-me-in-production",
        "ci-test-secret",
        "ci-zap-secret",
    }
)

WEAK_SFU_SECRETS: frozenset[str] = frozenset(
    {
        "",
        "ssc-sfu-dev-secret",
    }
)

MIN_JWT_SECRET_LEN = 32
MIN_SFU_SECRET_LEN = 24


def validate_production_startup(settings: Settings) -> None:
    """Raise RuntimeError if production configuration is unsafe."""
    if not settings.is_production:
        return

    ok, missing = production_env_valid(dict(os.environ))
    if not ok:
        raise RuntimeError(f"production_env_invalid: {', '.join(missing)}")

    secret = settings.jwt_secret.strip()
    if secret in WEAK_JWT_SECRETS or len(secret) < MIN_JWT_SECRET_LEN:
        raise RuntimeError(
            f"production_requires_strong_jwt_secret: min {MIN_JWT_SECRET_LEN} chars, not a dev default"
        )

    sfu_secret = (os.getenv("SSC_SFU_INTERNAL_SECRET") or "").strip()
    if sfu_secret in WEAK_SFU_SECRETS or len(sfu_secret) < MIN_SFU_SECRET_LEN:
        raise RuntimeError(
            f"production_requires_strong_sfu_secret: min {MIN_SFU_SECRET_LEN} chars, set SSC_SFU_INTERNAL_SECRET"
        )

    for origin in settings.cors_origins:
        if origin.strip() == "*":
            raise RuntimeError("production_cors_wildcard_forbidden_with_credentials")
        if not origin.startswith("https://"):
            raise RuntimeError(f"production_cors_https_required: {origin}")

    from core.captcha import captcha_required  # noqa: PLC0415
    from core.device_attestation import attestation_configured, require_device_attestation  # noqa: PLC0415

    if captcha_required() and not (os.getenv("SSC_TURNSTILE_SECRET") or "").strip():
        raise RuntimeError("production_captcha_secret_missing: SSC_TURNSTILE_SECRET required")

    if require_device_attestation() and not attestation_configured():
        raise RuntimeError(
            "production_device_attest_not_configured: set SSC_DESKTOP_ATTEST_SECRET "
            "and/or SSC_PLAY_INTEGRITY_SECRET and/or SSC_DEVICECHECK_SECRET"
        )




def engine_phase1_startup_gates_ready() -> bool:
    return MIN_JWT_SECRET_LEN >= 32 and MIN_SFU_SECRET_LEN >= 24