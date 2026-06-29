"""Q.61 — Code signing policy tests."""
from pathlib import Path

from core.code_signing_policy import (
    CODE_SIGNING_REQUIREMENTS,
    MAC_NOTARIZE_ENV,
    WIN_AUTHENTICODE_ENV,
    code_signing_public_config,
    signing_env_documentation,
)

REPO = Path(__file__).resolve().parents[2]


def test_code_signing_public_config_defaults_unsigned():
    cfg = code_signing_public_config()
    assert cfg["windows"]["authenticode_enabled"] is False
    assert cfg["windows"]["smartscreen_unsigned_warning"] is True
    assert cfg["mac"]["notarize_enabled"] is False
    assert len(cfg["requirements"]) == len(CODE_SIGNING_REQUIREMENTS)


def test_signing_env_documentation_lists_vars():
    docs = signing_env_documentation()
    assert "CSC_LINK" in docs["windows"]
    assert "APPLE_TEAM_ID" in docs["mac"]


def test_config_route_exposes_code_signing(monkeypatch):
    monkeypatch.delenv(WIN_AUTHENTICODE_ENV, raising=False)
    monkeypatch.delenv(MAC_NOTARIZE_ENV, raising=False)
    from routers.config_route import public_config
    import asyncio

    data = asyncio.run(public_config())
    assert "code_signing" in data
    assert "windows" in data["code_signing"]


def test_founder_setup_doc_exists():
    assert (REPO / "scripts" / "CODE_SIGNING_SETUP.txt").is_file()


def test_desktop_signing_config_exists():
    assert (REPO / "frontend" / "desktop" / "signing.config.json").is_file()


def test_electron_builder_wiring():
    pkg = (REPO / "frontend" / "desktop" / "package.json").read_text(encoding="utf-8")
    cfg = (REPO / "frontend" / "desktop" / "electron-builder.config.mjs").read_text(encoding="utf-8")
    assert "entitlements.mac.plist" in pkg
    assert "afterSign" in pkg
    assert "signing.config.json" in pkg
    assert "signAndEditExecutable" in cfg
    assert "CSC_LINK" in cfg


def test_mac_entitlements_present():
    text = (REPO / "frontend" / "desktop" / "build-resources" / "entitlements.mac.plist").read_text(
        encoding="utf-8"
    )
    assert "com.apple.security.cs.allow-jit" in text