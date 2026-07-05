"""Step 8 — release v0.2.0 policy tests."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
VERSION = "0.2.0"


def test_changelog_has_v020():
    text = (REPO / "CHANGELOG.md").read_text(encoding="utf-8")
    assert f"## [{VERSION}]" in text
    assert "libsignal" in text.lower()


def test_release_checklist_exists():
    path = REPO / "memory" / "RELEASE_v0.2.0_CHECKLIST.md"
    assert path.is_file()
    assert VERSION in path.read_text(encoding="utf-8")


def test_third_party_notices_libsignal():
    text = (REPO / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
    assert "libsignal" in text.lower()
    assert "AGPL" in text


def test_landing_production_example():
    text = (REPO / "frontend" / ".env.production.example").read_text(encoding="utf-8")
    assert "REACT_APP_SSC_LANDING_ONLY=true" in text
    assert "REACT_APP_SSC_VERSION=" in text