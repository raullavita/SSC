"""Q.60 — Public status page policy (health summary + incident notes)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

STATUS_PAGE_PUBLIC_PATH = "/status"
STATUS_INCIDENTS_FILE = Path(__file__).resolve().parents[2] / "status_incidents.json"

COMPONENT_LABELS = {
    "api": "API",
    "mongo": "Database",
    "redis": "Redis",
    "ws_fanout": "Realtime",
}


def _default_incidents_payload() -> Dict[str, Any]:
    return {"incidents": []}


def load_status_incidents() -> List[Dict[str, Any]]:
    if not STATUS_INCIDENTS_FILE.is_file():
        return []
    try:
        raw = json.loads(STATUS_INCIDENTS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        items = raw.get("incidents")
        return items if isinstance(items, list) else []
    return []


def component_status_from_health(health: Dict[str, Any]) -> Dict[str, str]:
    mongo = (health.get("mongo") or {}).get("status", "unknown")
    redis = (health.get("redis") or {}).get("status", "unknown")
    ws = health.get("ws_fanout", "unknown")
    overall = health.get("status", "unknown")
    return {
        "api": "operational" if overall in ("ok", "degraded") else "outage",
        "mongo": "operational" if mongo == "ok" else "outage",
        "redis": "operational" if redis in ("ok", "disabled") else "outage",
        "ws_fanout": "operational" if ws in ("redis", "local_only") else "degraded",
    }


def build_public_status_payload(health: Dict[str, Any], *, updated_at: str) -> Dict[str, Any]:
    components = component_status_from_health(health)
    incidents = load_status_incidents()
    active = [i for i in incidents if (i.get("status") or "").lower() in ("investigating", "identified", "monitoring")]
    return {
        "overall": health.get("status", "unknown"),
        "env": health.get("env"),
        "components": components,
        "component_labels": dict(COMPONENT_LABELS),
        "incidents": incidents,
        "active_incident_count": len(active),
        "updated_at": updated_at,
        "page_path": STATUS_PAGE_PUBLIC_PATH,
    }