"""Q.59 — Crash reporting opt-in policy tests."""
from pathlib import Path

from core.crash_reporting_policy import (
    CRASH_REPORTING_OPT_IN_DEFAULT,
    CRASH_REPORTING_STORAGE_KEY,
    NEVER_COLLECTED,
    crash_reporting_public_config,
)


REPO = Path(__file__).resolve().parents[2]


def test_crash_reporting_defaults_off():
    assert CRASH_REPORTING_OPT_IN_DEFAULT is False


def test_crash_reporting_public_config_shape():
    cfg = crash_reporting_public_config()
    assert cfg["opt_in_default"] is False
    assert cfg["storage_key"] == CRASH_REPORTING_STORAGE_KEY
    assert cfg["providers"]["android"] == "firebase_crashlytics"
    assert cfg["providers"]["desktop"] == "sentry"
    assert cfg["providers"]["web"] == "none"
    assert "stack_trace" in cfg["collected_when_opted_in"]
    for field in NEVER_COLLECTED:
        assert field in cfg["never_collected"]


def test_public_config_route_exposes_crash_reporting():
    from routers.config_route import public_config
    import asyncio

    data = asyncio.run(public_config())
    assert "crash_reporting" in data
    assert data["crash_reporting"]["opt_in_default"] is False


def test_settings_wires_crash_reporting_toggle():
    settings = (REPO / "frontend/src/components/SettingsModal.jsx").read_text(encoding="utf-8")
    assert "settings-crash-reporting" in settings
    assert "setCrashReportingOptIn" in settings


def test_app_bootstraps_crash_reporting():
    app_js = (REPO / "frontend/src/App.js").read_text(encoding="utf-8")
    assert "initCrashReportingFromStorage" in app_js