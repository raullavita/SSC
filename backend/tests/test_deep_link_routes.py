"""Regression tests for installed-client deep link routing (Electron/Android)."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def _route_from_deep_link(raw_url: str) -> str:
    """Mirror of electron/main.js routeFromDeepLink for regression coverage."""
    if not raw_url or not raw_url.startswith("ssc://"):
        return "/"
    try:
        without_scheme = raw_url[len("ssc://") :]
        slash_idx = without_scheme.find("/")
        host = (without_scheme[:slash_idx] if slash_idx >= 0 else without_scheme).lower()
        rest = without_scheme[slash_idx:] if slash_idx >= 0 else ""
        q_idx = rest.find("?")
        path_part = rest[:q_idx] if q_idx >= 0 else rest
        query = rest[q_idx:] if q_idx >= 0 else ""

        if host == "auth":
            return f"/auth/google{query}"
        if host == "link-device":
            return f"/link-device{query}"
        if host == "add":
            username = path_part.lstrip("/").strip()
            return f"/add/{username}{query}" if username else "/"
    except Exception:
        return "/"
    return "/"


def test_oauth_deep_link_route():
    assert (
        _route_from_deep_link("ssc://auth/google?oauth_code=abc123")
        == "/auth/google?oauth_code=abc123"
    )


def test_electron_main_uses_manual_deep_link_parser():
    main = (REPO / "electron" / "main.js").read_text(encoding="utf-8")
    assert "withoutScheme" in main
    assert "host === 'auth'" in main
    assert 'parsed.hostname.toLowerCase() === API_HOST' not in main.split("routeFromDeepLink")[1][:600]