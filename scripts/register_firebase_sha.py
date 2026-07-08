#!/usr/bin/env python3
"""Register Android SHA-256 fingerprints in Firebase (SSC Installed app).

Requires one of:
  - GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON
  - ssc-firebase-key.json in repo root (gitignored)
  - gcloud application-default credentials
  - firebase CLI logged in (calls this script's API path as fallback)

Usage:
  python scripts/register_firebase_sha.py
  python scripts/register_firebase_sha.py --sha D1:7E:49:...
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT_ID = "super-chat-b0992"
# com.supersecurechat.app — SSC Installed (from google-services.json)
ANDROID_APP_ID = "1:814078411789:android:88e548025619ab48c68144"


def _normalize_sha(value: str) -> str:
    cleaned = re.sub(r"[^0-9A-Fa-f]", "", value).upper()
    if len(cleaned) != 64:
        raise ValueError(f"invalid_sha256: {value}")
    return cleaned


def _load_shas_from_keystores() -> list[str]:
    shas: list[str] = []
    keytool = "keytool"

    release_env = Path.home() / ".ssc" / "android-signing.env"
    if release_env.exists():
        env = {}
        for line in release_env.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
        ks = env.get("SSC_ANDROID_KEYSTORE")
        alias = env.get("SSC_ANDROID_KEY_ALIAS", "ssc-release")
        pw = env.get("SSC_ANDROID_KEYSTORE_PASSWORD")
        if ks and Path(ks).exists() and pw:
            out = subprocess.check_output(
                [keytool, "-list", "-v", "-keystore", ks, "-alias", alias, "-storepass", pw],
                text=True,
                stderr=subprocess.STDOUT,
            )
            m = re.search(r"SHA256:\s*([0-9A-Fa-f:]+)", out)
            if m:
                shas.append(_normalize_sha(m.group(1)))

    debug_ks = Path.home() / ".android" / "debug.keystore"
    if debug_ks.exists():
        out = subprocess.check_output(
            [
                keytool,
                "-list",
                "-v",
                "-keystore",
                str(debug_ks),
                "-alias",
                "androiddebugkey",
                "-storepass",
                "android",
                "-keypass",
                "android",
            ],
            text=True,
            stderr=subprocess.STDOUT,
        )
        m = re.search(r"SHA256:\s*([0-9A-Fa-f:]+)", out)
        if m:
            shas.append(_normalize_sha(m.group(1)))

    # de-dupe preserve order
    seen = set()
    unique = []
    for s in shas:
        if s not in seen:
            seen.add(s)
            unique.append(s)
    return unique


def _credential_path() -> str | None:
    for candidate in (
        os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip(),
        str(ROOT / "ssc-firebase-key.json"),
        str(Path.home() / "Desktop" / "ssc-firebase-key.json"),
    ):
        if candidate and Path(candidate).is_file():
            return candidate
    return None


def _register_via_api(sha_hashes: list[str]) -> list[str]:
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    cred_path = _credential_path()
    if not cred_path:
        raise RuntimeError("no_service_account_credentials")

    creds = service_account.Credentials.from_service_account_file(
        cred_path,
        scopes=["https://www.googleapis.com/auth/firebase"],
    )
    service = build("firebase", "v1beta1", credentials=creds, cache_discovery=False)
    parent = f"projects/{PROJECT_ID}/androidApps/{ANDROID_APP_ID}"

    added = []
    existing = service.projects().androidApps().shaCertificates().list(parent=parent).execute()
    have = {
        item.get("shaHash", "").upper()
        for item in existing.get("certificates", [])
    }

    for sha in sha_hashes:
        if sha in have:
            print(f"SKIP (already registered): {sha}")
            continue
        body = {"shaHash": sha, "certType": "SHA_256"}
        service.projects().androidApps().shaCertificates().create(parent=parent, body=body).execute()
        print(f"ADDED: {sha}")
        added.append(sha)
    return added


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sha", action="append", default=[], help="SHA-256 (colon or plain hex)")
    args = parser.parse_args()

    shas = [_normalize_sha(s) for s in args.sha] if args.sha else _load_shas_from_keystores()
    if not shas:
        print("No SHA fingerprints found. Run create_android_keystore.ps1 or build Android once.", file=sys.stderr)
        return 1

    print(f"Project: {PROJECT_ID}")
    print(f"App: com.supersecurechat.app ({ANDROID_APP_ID})")
    for sha in shas:
        pretty = ":".join(sha[i : i + 2] for i in range(0, 64, 2))
        print(f"  SHA-256: {pretty}")

    try:
        added = _register_via_api(shas)
    except Exception as exc:  # noqa: BLE001
        print(f"\nFirebase API registration failed: {exc}", file=sys.stderr)
        print("\nManual steps:", file=sys.stderr)
        print("  Firebase Console -> Project settings -> SSC Installed -> Add fingerprint", file=sys.stderr)
        print("  Or place service account JSON at ssc-firebase-key.json and re-run.", file=sys.stderr)
        return 2

    if added:
        print(f"\nRegistered {len(added)} fingerprint(s) in Firebase.")
    else:
        print("\nAll fingerprints were already registered.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())