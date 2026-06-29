"""Q.60 — Public status page tests."""
from pathlib import Path

from core.status_page_policy import (
    STATUS_PAGE_PUBLIC_PATH,
    build_public_status_payload,
    load_status_incidents,
)

REPO = Path(__file__).resolve().parents[2]


def test_status_incidents_file_exists():
    assert (REPO / "status_incidents.json").is_file()


def test_load_incidents_defaults_empty():
    incidents = load_status_incidents()
    assert isinstance(incidents, list)


def test_build_public_status_payload_shape():
    health = {
        "status": "ok",
        "env": "development",
        "mongo": {"status": "ok"},
        "redis": {"status": "ok"},
        "ws_fanout": "redis",
    }
    payload = build_public_status_payload(health, updated_at="2026-06-29T12:00:00Z")
    assert payload["overall"] == "ok"
    assert payload["page_path"] == STATUS_PAGE_PUBLIC_PATH
    assert payload["components"]["api"] == "operational"
    assert "incidents" in payload


def test_status_route_registered():
    init_py = (REPO / "backend" / "routers" / "__init__.py").read_text(encoding="utf-8")
    assert "status_page_router" in init_py


def test_status_page_route_in_app():
    app = (REPO / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    assert 'path="/status"' in app
    assert "Status" in app


def test_landing_links_status():
    landing = (REPO / "frontend" / "src" / "pages" / "Landing.jsx").read_text(encoding="utf-8")
    assert 'to="/status"' in landing