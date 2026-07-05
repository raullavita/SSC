"""Rotate Upstash Redis password only — updates backend/cloudrun-env.yaml."""

from __future__ import annotations

import base64
import os
import sys
from pathlib import Path
import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from secret_url_builders import build_redis_tls_url
CREDS = ROOT / "atlas-credentials.env"
ENV_FILE = ROOT / "backend" / "cloudrun-env.yaml"


def main() -> int:
    load_dotenv(CREDS)
    email = os.getenv("UPSTASH_EMAIL", "").strip()
    api_key = os.getenv("UPSTASH_API_KEY", "").strip()
    if not email or not api_key:
        print("FAIL: set UPSTASH_EMAIL and UPSTASH_API_KEY in atlas-credentials.env")
        return 1

    auth = base64.b64encode(f"{email}:{api_key}".encode()).decode()
    headers = {"Authorization": f"Basic {auth}"}

    with httpx.Client(timeout=60.0) as client:
        listed = client.get("https://api.upstash.com/v2/redis/databases", headers=headers)
        listed.raise_for_status()
        databases = listed.json()

        target = None
        for row in databases:
            if "merry-mole-114510" in str(row.get("endpoint", "")):
                target = row
                break
        if not target:
            print("FAIL: merry-mole-114510 database not found")
            return 1

        db_id = target["database_id"]
        reset = client.post(
            f"https://api.upstash.com/v2/redis/reset-password/{db_id}",
            headers=headers,
        )
        reset.raise_for_status()
        updated = reset.json()

    password = updated.get("password") or updated.get("redis_password")
    if not password:
        print("FAIL: reset-password response missing password")
        return 1

    host = updated.get("endpoint", target.get("endpoint", "merry-mole-114510"))
    if not str(host).endswith(".upstash.io"):
        host = f"{host}.upstash.io"
    redis_url = build_redis_tls_url(password, host)

    lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
    out = []
    replaced = False
    for line in lines:
        if line.startswith("REDIS_URL:"):
            out.append(f'REDIS_URL: "{redis_url}"')
            replaced = True
        else:
            out.append(line)
    if not replaced:
        out.append(f'REDIS_URL: "{redis_url}"')
    ENV_FILE.write_text("\n".join(out) + "\n", encoding="utf-8")
    print("OK: REDIS_URL rotated in backend/cloudrun-env.yaml")
    return 0


if __name__ == "__main__":
    sys.exit(main())