"""TURN / ICE readiness for off-LAN call proof — Q.31 (TASK P.6 / I.3)."""
from __future__ import annotations

from typing import Any, Dict, List

from core.egress_policy import _turn_credentials_set, build_ice_servers


def _relay_urls_from_ice(servers: List[Dict[str, str]]) -> List[str]:
    out: List[str] = []
    for entry in servers:
        urls = str(entry.get("urls") or "")
        if "turn:" in urls.lower() or "turns:" in urls.lower():
            out.append(urls)
    return out


def calls_public_config() -> Dict[str, Any]:
    """Public call/TURN hints for clients and founder verification scripts."""
    servers = build_ice_servers()
    relay_urls = _relay_urls_from_ice(servers)
    turn_configured = _turn_credentials_set()
    return {
        "turn_configured": turn_configured,
        "ice_server_count": len(servers),
        "relay_server_count": len(relay_urls),
        "has_metered_relay": any("metered.ca" in u for u in relay_urls),
        "off_lan_proof_required": True,
    }


def turn_proof_status() -> Dict[str, Any]:
    """Machine-readable gate for scripts — config ready vs device proof done."""
    cfg = calls_public_config()
    cfg["config_ready"] = cfg["turn_configured"] and cfg["relay_server_count"] > 0
    cfg["device_proof_done"] = False
    return cfg