"""Validate required environment variables before deploy or dev start."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

REQUIRED = [
    ("MONGO_URL", "MongoDB connection string"),
    ("JWT_SECRET", "Session signing secret"),
]

PRODUCTION_EXTRA = [
    ("REDIS_URL", "Redis required for production session validation"),
]

OPTIONAL = [
    ("REDIS_URL", "Redis for sessions, rate limits, WS fanout"),
    ("GOOGLE_APPLICATION_CREDENTIALS", "Firebase push (service account path)"),
    ("LIBRETRANSLATE_API_KEY", "Translation API key (optional)"),
    ("SSC_SFU_WS_URL", "mediasoup SFU WebSocket URL"),
]


def check() -> bool:
    ok = True
    is_production = os.getenv("SSC_ENV", "development") == "production"

    for key, label in REQUIRED:
        value = os.getenv(key, "").strip()
        if value:
            print(f"PASS: {key} set")
        else:
            print(f"FAIL: {key} missing — {label}")
            ok = False

    if is_production:
        from core.deploy_policy import production_env_valid  # noqa: PLC0415

        prod_ok, missing = production_env_valid(dict(os.environ))
        for item in missing:
            print(f"FAIL: production — {item}")
        ok = ok and prod_ok
        for key, label in PRODUCTION_EXTRA:
            if os.getenv(key, "").strip():
                print(f"PASS: {key} set (production)")
            else:
                print(f"FAIL: {key} missing — {label}")
                ok = False

    for key, label in OPTIONAL:
        value = os.getenv(key, "").strip()
        if not value:
            print(f"WARN: {key} not set — {label}")
            continue
        if key == "GOOGLE_APPLICATION_CREDENTIALS":
            path = Path(value)
            if path.is_file():
                print(f"PASS: {key} points to existing file")
            else:
                print(f"WARN: {key} set but file not found: {value}")
        else:
            print(f"PASS: {key} set")

    try:
        import firebase_admin  # noqa: F401 — optional dep, checked at deploy time
        print("PASS: Firebase Admin SDK importable (if installed)")
    except ImportError:
        print("WARN: firebase-admin not installed (optional for push)")

    print("---")
    print("READY" if ok else "NOT READY")
    return ok


if __name__ == "__main__":
    sys.exit(0 if check() else 1)