"""Rotate leaked production secrets — local only, never commit output.

Updates backend/cloudrun-env.yaml and prints next deploy commands.
"""

from __future__ import annotations

import base64
import os
import secrets
import sys
from pathlib import Path
from urllib.parse import quote_plus

import httpx
import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
CREDS = ROOT / "atlas-credentials.env"
ENV_FILE = ROOT / "backend" / "cloudrun-env.yaml"
API_VERSION = "application/vnd.atlas.2023-01-01+json"
ATLAS_BASE = "https://cloud.mongodb.com/api/atlas/v2"
MONGO_USER = "raullavita1988_db_user"
MONGO_CLUSTER_HOST = "ssc.acq665o.mongodb.net"
MONGO_DB = "ssc"


def _atlas_token(client: httpx.Client) -> str:
    client_id = os.environ["ATLAS_CLIENT_ID"].strip()
    client_secret = os.environ["ATLAS_CLIENT_SECRET"].strip()
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    resp = client.post(
        "https://cloud.mongodb.com/api/oauth/token",
        headers={
            "Authorization": f"Basic {basic}",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
        data="grant_type=client_credentials",
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def rotate_mongo_password(client: httpx.Client, token: str, group_id: str) -> str:
    password = secrets.token_urlsafe(24)
    url = f"{ATLAS_BASE}/groups/{group_id}/databaseUsers/admin/{quote_plus(MONGO_USER)}"
    resp = client.patch(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": API_VERSION,
            "Content-Type": "application/json",
        },
        json={"password": password},
    )
    resp.raise_for_status()
    return password


def new_jwt_secret() -> str:
    return secrets.token_urlsafe(48)


def new_sfu_secret() -> str:
    return secrets.token_urlsafe(32)


def rotate_redis_url(client: httpx.Client) -> str:
    email = os.getenv("UPSTASH_EMAIL", "raullavita1988@gmail.com").strip()
    api_key = os.environ["UPSTASH_API_KEY"].strip()
    basic = base64.b64encode(f"{email}:{api_key}".encode()).decode()
    headers = {"Authorization": f"Basic {basic}"}

    listed = client.get("https://api.upstash.com/v2/redis/databases", headers=headers)
    listed.raise_for_status()
    databases = listed.json() if listed.headers.get("content-type", "").startswith("application/json") else []

    target = None
    for row in databases:
        endpoint = str(row.get("endpoint", ""))
        if "merry-mole-114510" in endpoint:
            target = row
            break
    if not target:
        raise RuntimeError("Upstash database merry-mole-114510 not found in account")

    db_id = target["database_id"]
    reset = client.post(f"https://api.upstash.com/v2/redis/reset-password/{db_id}", headers=headers)
    reset.raise_for_status()
    updated = reset.json()
    password = updated.get("password") or updated.get("redis_password")
    if not password:
        raise RuntimeError("Upstash reset-password response missing password field")

    host = updated.get("endpoint", target.get("endpoint", "merry-mole-114510"))
    if not host.endswith(".upstash.io"):
        host = f"{host}.upstash.io"
    return f"rediss://default:{quote_plus(password)}@{host}:6379"


def load_env_yaml() -> dict:
    with ENV_FILE.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def save_env_yaml(data: dict) -> None:
    lines = []
    for key, value in data.items():
        if isinstance(value, bool):
            rendered = f'"{"true" if value else "false"}"'
        else:
            rendered = str(value)
            if not (rendered.startswith('"') and rendered.endswith('"')):
                rendered = f'"{rendered}"'
        lines.append(f"{key}: {rendered}")
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    load_dotenv(CREDS)
    missing = [k for k in ("ATLAS_CLIENT_ID", "ATLAS_CLIENT_SECRET", "ATLAS_GROUP_ID") if not os.getenv(k, "").strip()]
    if missing:
        print(f"FAIL: set {', '.join(missing)} in {CREDS}")
        return 1

    group_id = os.environ["ATLAS_GROUP_ID"].strip()
    env = load_env_yaml()

    jwt_secret = new_jwt_secret()
    sfu_secret = new_sfu_secret()

    with httpx.Client(timeout=60.0) as client:
        token = _atlas_token(client)
        mongo_password = rotate_mongo_password(client, token, group_id)
        redis_url = rotate_redis_url(client) if os.getenv("UPSTASH_API_KEY", "").strip() else ""

    env["JWT_SECRET"] = jwt_secret
    env["MONGO_URL"] = (
        f"mongodb+srv://{MONGO_USER}:{quote_plus(mongo_password)}@"
        f"{MONGO_CLUSTER_HOST}/{MONGO_DB}?retryWrites=true&w=majority&appName=SSC"
    )
    env["SSC_SFU_INTERNAL_SECRET"] = sfu_secret
    if redis_url:
        env["REDIS_URL"] = redis_url
        print("REDIS_URL rotated via Upstash API")
    elif os.getenv("SSC_NEW_REDIS_URL", "").strip():
        env["REDIS_URL"] = os.environ["SSC_NEW_REDIS_URL"].strip()
        print("REDIS_URL updated from SSC_NEW_REDIS_URL")
    else:
        print("REDIS_URL unchanged — add UPSTASH_EMAIL + UPSTASH_API_KEY to atlas-credentials.env and re-run")

    save_env_yaml(env)
    print(f"OK: rotated Mongo password, JWT_SECRET, SSC_SFU_INTERNAL_SECRET in {ENV_FILE}")
    print("NEXT:")
    print("  gcloud run services update ssc-api --region=europe-west1 --project=super-chat-b0992 --env-vars-file=backend/cloudrun-env.yaml")
    print(f"  $env:SFU_INTERNAL_SECRET='<rotated>'; .\\scripts\\deploy_sfu_gce.ps1")
    return 0


if __name__ == "__main__":
    sys.exit(main())