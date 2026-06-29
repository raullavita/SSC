#!/usr/bin/env python3
"""Q.31 / TASK P.6 — verify production exposes TURN relay ICE servers."""
from __future__ import annotations

import json
import os
import sys
import urllib.request

API_BASE = (os.environ.get("SSC_API_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "https://api.supersecurechat.com").rstrip("/")
CONFIG_URL = f"{API_BASE}/api/config"


def main() -> int:
    print(f"Q.31 TURN config smoke — {CONFIG_URL}")
    try:
        with urllib.request.urlopen(CONFIG_URL, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"FAIL: could not fetch config — {exc}")
        return 1

    calls = data.get("calls") or {}
    ice = data.get("ice_servers") or []
    relay = [s for s in ice if "turn" in str(s.get("urls", "")).lower()]
    credentialed_relay = [
        s for s in relay
        if (s.get("username") or "").strip() and (s.get("credential") or "").strip()
    ]
    turn_configured = calls.get("turn_configured")
    if turn_configured is None:
        turn_configured = len(credentialed_relay) > 0

    print(json.dumps({
        "turn_configured": turn_configured,
        "relay_server_count": calls.get("relay_server_count", len(relay)),
        "has_metered_relay": calls.get("has_metered_relay", any(
            "metered.ca" in str(s.get("urls", "")) for s in relay
        )),
        "ice_server_count": len(ice),
        "relay_urls_found": len(relay),
        "credentialed_relay_urls": len(credentialed_relay),
        "off_lan_proof_required": calls.get("off_lan_proof_required", True),
        "calls_block_present": bool(data.get("calls")),
    }, indent=2))

    if not turn_configured:
        print("FAIL: TURN credentials not active in this deployment")
        return 1
    if len(credentialed_relay) < 1:
        print("FAIL: no credentialed relay (TURN) URLs in ice_servers")
        return 1

    print("OK: TURN relay ICE is configured — founder must still run off-LAN device matrix (P.6)")
    print("See test_reports/Q31_TURN_OFF_LAN_MATRIX.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())