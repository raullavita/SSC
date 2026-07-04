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

OPTIONAL = [
    ("REDIS_URL", "Redis for sessions, rate limits, WS fanout"),
    ("GOOGLE_APPLICATION_CREDENTIALS", "Firebase push (service account path)"),
]


def check() -> bool:
    ok = True
    for key, label in REQUIRED:
        value = os.getenv(key, "").strip()
        if value:
            print(f"PASS: {key} set")
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
        print("WARN: firebase-admin not installed (optional for Phase 0)")

    print("---")
    print("READY" if ok else "NOT READY")
    return ok


if __name__ == "__main__":
    sys.exit(0 if check() else 1)