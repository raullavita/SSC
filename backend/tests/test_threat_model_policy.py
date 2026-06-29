"""Q.57 — public threat-model page policy tests."""
from pathlib import Path

from core.threat_model_policy import (
    PUBLIC_THREAT_MODEL_COMPONENT,
    PUBLIC_THREAT_MODEL_ROUTE,
    SECURITY_MODEL_COMPANION,
    THREAT_MODEL_REQUIREMENTS,
    THREAT_MODEL_SECTIONS,
)

REPO = Path(__file__).resolve().parents[2]


def test_public_route_and_component():
    assert PUBLIC_THREAT_MODEL_ROUTE == "/security"
    assert (REPO / PUBLIC_THREAT_MODEL_COMPONENT).is_file()


def test_companion_security_model_exists():
    assert (REPO / SECURITY_MODEL_COMPANION).is_file()


def test_sections_documented():
    assert len(THREAT_MODEL_SECTIONS) >= 5
    assert "honest_limits" in THREAT_MODEL_SECTIONS


def test_requirements_documented():
    assert len(THREAT_MODEL_REQUIREMENTS) >= 3
    assert "no_false_signal_claims_for_browser" in THREAT_MODEL_REQUIREMENTS


def test_app_router_wires_security_route():
    app = (REPO / "frontend/src/App.js").read_text(encoding="utf-8")
    assert 'path="/security"' in app
    assert "ThreatModel" in app


def test_landing_links_threat_model():
    landing = (REPO / "frontend/src/pages/Landing.jsx").read_text(encoding="utf-8")
    assert 'to="/security"' in landing
    assert "landingNavThreatModel" in landing


def test_threat_model_page_covers_key_topics():
    page = (REPO / PUBLIC_THREAT_MODEL_COMPONENT).read_text(encoding="utf-8")
    assert "PQXDH" in page or "post-quantum" in page.lower()
    assert "server" in page.lower()
    assert "GitHub Security Advisories" in page
    assert "developer shell" in page.lower() or "not a product" in page.lower()