"""Q.58 — disclose.io VDP + security.txt tests."""
from pathlib import Path

from core.disclosure_policy import (
    API_ORIGIN,
    CONTACT_EMAIL,
    DISCLOSE_IO_FRAMEWORK,
    GITHUB_ADVISORY_URL,
    SITE_ORIGIN,
    VDP_PUBLIC_PATH,
    VDP_PUBLIC_URL,
    render_security_txt,
    security_txt_has_required_fields,
    vdp_has_safe_harbor,
)

REPO = Path(__file__).resolve().parents[2]


def test_render_security_txt_web():
    body = render_security_txt(canonical_origin=SITE_ORIGIN)
    assert security_txt_has_required_fields(body)
    assert CONTACT_EMAIL in body
    assert GITHUB_ADVISORY_URL in body
    assert VDP_PUBLIC_URL in body
    assert "Canonical: https://www.supersecurechat.com/.well-known/security.txt" in body


def test_render_security_txt_api():
    body = render_security_txt(canonical_origin=API_ORIGIN)
    assert "Canonical: https://api.supersecurechat.com/.well-known/security.txt" in body


def test_public_security_txt_files_match_policy():
    for rel in (
        "frontend/public/.well-known/security.txt",
        "frontend/public/security.txt",
    ):
        text = (REPO / rel).read_text(encoding="utf-8")
        assert security_txt_has_required_fields(text)
        assert VDP_PUBLIC_URL in text


def test_vulnerability_disclosure_policy_markdown():
    md = (REPO / "VULNERABILITY_DISCLOSURE_POLICY.md").read_text(encoding="utf-8")
    assert DISCLOSE_IO_FRAMEWORK.split()[0] in md
    assert vdp_has_safe_harbor(md)
    assert "90 days" in md
    assert GITHUB_ADVISORY_URL in md


def test_well_known_router_registered():
    server = (REPO / "backend/server.py").read_text(encoding="utf-8")
    assert "well_known" in server


def test_vdp_public_route():
    app = (REPO / "frontend/src/App.js").read_text(encoding="utf-8")
    assert f'path="{VDP_PUBLIC_PATH}"' in app
    assert "VulnerabilityDisclosure" in app


def test_landing_links_vdp():
    landing = (REPO / "frontend/src/pages/Landing.jsx").read_text(encoding="utf-8")
    assert f'to="{VDP_PUBLIC_PATH}"' in landing