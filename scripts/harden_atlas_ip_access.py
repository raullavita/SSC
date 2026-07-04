"""Remove personal IPs from Atlas project access list — keep Cloud Run NAT only.

Requires atlas-credentials.env (see atlas-credentials.env.example).
Never commit atlas-credentials.env.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
CREDS = ROOT / "atlas-credentials.env"
KEEP = os.getenv("SSC_ATLAS_KEEP_CIDR", "34.140.240.41/32")
API_VERSION = "application/vnd.atlas.2023-01-01+json"
BASE = "https://cloud.mongodb.com/api/atlas/v2"


def _client() -> httpx.Client:
    public = os.environ["ATLAS_PUBLIC_KEY"].strip()
    private = os.environ["ATLAS_PRIVATE_KEY"].strip()
    return httpx.Client(
        auth=httpx.DigestAuth(public, private),
        headers={"Accept": API_VERSION},
        timeout=30.0,
    )


def resolve_group_id(client: httpx.Client) -> str:
    configured = os.getenv("ATLAS_GROUP_ID", "").strip()
    if configured:
        return configured

    cluster = os.getenv("ATLAS_CLUSTER_NAME", "ssc").strip()
    resp = client.get(f"{BASE}/groups")
    resp.raise_for_status()
    for project in resp.json().get("results", []):
        group_id = project["id"]
        clusters = client.get(f"{BASE}/groups/{group_id}/clusters")
        if clusters.status_code != 200:
            continue
        for item in clusters.json().get("results", []):
            if item.get("name") == cluster:
                return group_id
    raise RuntimeError(f"Atlas project with cluster '{cluster}' not found")


def main() -> int:
    load_dotenv(CREDS)
    missing = [k for k in ("ATLAS_PUBLIC_KEY", "ATLAS_PRIVATE_KEY") if not os.getenv(k, "").strip()]
    if missing:
        print(f"FAIL: set {', '.join(missing)} in {CREDS}")
        return 1

    with _client() as client:
        group_id = resolve_group_id(client)
        print(f"Atlas project: {group_id}")
        print(f"Keeping only: {KEEP}")

        resp = client.get(f"{BASE}/groups/{group_id}/accessList")
        resp.raise_for_status()
        entries = resp.json().get("results", [])

        removed = 0
        for entry in entries:
            cidr = entry.get("cidrBlock") or entry.get("ipAddress") or ""
            if not cidr:
                continue
            if cidr == KEEP or cidr == KEEP.replace("/32", ""):
                print(f"KEEP: {cidr}")
                continue
            encoded = quote(cidr, safe="")
            del_resp = client.delete(f"{BASE}/groups/{group_id}/accessList/{encoded}")
            if del_resp.status_code == 204:
                print(f"REMOVED: {cidr}")
                removed += 1
            else:
                print(f"FAIL remove {cidr}: {del_resp.status_code} {del_resp.text[:200]}")

    print(f"Done. Removed {removed} entr{'y' if removed == 1 else 'ies'}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())