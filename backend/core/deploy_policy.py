"""Production deploy policy — Engine 10."""

from __future__ import annotations

import os

PRODUCTION_API_HOST = os.getenv("SSC_PRODUCTION_API_HOST", "api.supersecurechat.com")
PRODUCTION_WEB_HOST = os.getenv("SSC_PRODUCTION_WEB_HOST", "www.supersecurechat.com")

PRODUCTION_CORS_ORIGINS: frozenset[str] = frozenset(
    {
        f"https://{PRODUCTION_WEB_HOST}",
        f"https://{PRODUCTION_WEB_HOST.replace('www.', '')}",
    }
)

CLOUD_RUN_SERVICE = os.getenv("SSC_CLOUD_RUN_SERVICE", "ssc-api")
CLOUD_RUN_REGION = os.getenv("SSC_CLOUD_RUN_REGION", "us-central1")
FIREBASE_PROJECT = os.getenv("SSC_FIREBASE_PROJECT", "supersecurechat")

PRODUCTION_REQUIRED_ENV: frozenset[str] = frozenset(
    {
        "MONGO_URL",
        "JWT_SECRET",
        "REDIS_URL",
        "SSC_ENV",
    }
)


def production_env_valid(env: dict[str, str]) -> tuple[bool, list[str]]:
    missing = [k for k in PRODUCTION_REQUIRED_ENV if not env.get(k, "").strip()]
    if env.get("SSC_ENV", "").strip() != "production":
        missing.append("SSC_ENV=production")
    if env.get("JWT_SECRET", "").strip() in ("", "dev-only-change-me", "change-me-in-production"):
        missing.append("JWT_SECRET must be rotated for production")
    return len(missing) == 0, missing


def engine10_deploy_policy_ready() -> bool:
    return bool(PRODUCTION_API_HOST) and bool(CLOUD_RUN_SERVICE)