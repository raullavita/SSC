"""Electron packaged shell fixes — post v0.3.0."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def test_electron_main_loads_packaged_app():
    main = (REPO / "electron" / "main.js").read_text(encoding="utf-8")
    assert "app.isPackaged" in main
    assert "process.resourcesPath" in main
    assert "resolvePackagedIndex" in main


def test_electron_preload_injects_client_header():
    preload = (REPO / "electron" / "preload.js").read_text(encoding="utf-8")
    assert "__SSC_ELECTRON_CLIENT" in preload
    assert "CLIENT_VALUE" in preload
    assert 'electron/${pkg.version}/' in preload


def test_build_electron_uses_numeric_build():
    script = (REPO / "scripts" / "build_electron.ps1").read_text(encoding="utf-8")
    assert 'REACT_APP_SSC_BUILD = "4"' in script
    assert 'REACT_APP_SSC_LANDING_ONLY = "false"' in script
    assert 'PUBLIC_URL = "."' in script


def test_frontend_electron_hash_router():
    index = (REPO / "frontend" / "src" / "index.js").read_text(encoding="utf-8")
    assert "HashRouter" in index
    assert "REACT_APP_SSC_PLATFORM === 'electron'" in index