"""Engine 3 Step 3.6 — unified client footprint orchestrator."""
from pathlib import Path

from core.client_footprint_policy import (
    CLIENT_WIPE_PHASE_1,
    ORCHESTRATOR_MODULE,
    PANIC_SERVER_ENDPOINT,
)


def test_orchestrator_module_exists():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "clientFootprintOrchestrator.js").read_text(encoding="utf-8")
    assert "executeClientFootprintWipe" in text
    assert "runPanicOrchestrator" in text
    assert "runLogoutOrchestrator" in text
    assert "capturePreWipeCredentials" in text
    assert "/panic-wipe" in text
    assert PANIC_SERVER_ENDPOINT.endswith("/panic-wipe")


def test_phase1_client_wipe_before_server_in_panic_orchestrator():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "clientFootprintOrchestrator.js").read_text(encoding="utf-8")
    panic_start = text.index("export async function runPanicOrchestrator")
    panic_body = text[panic_start:]
    assert panic_body.index("executeClientFootprintWipe('panic')") < panic_body.index("await postPanicWipe")
    assert panic_body.index("await postPanicWipe") < panic_body.index("sendNativeAppToBackground")
    assert panic_body.index("sendNativeAppToBackground") < panic_body.index("PANIC_REDIRECT")


def test_execute_client_wipe_runs_phase1_steps_in_order():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "clientFootprintOrchestrator.js").read_text(encoding="utf-8")
    start = text.index("export function executeClientFootprintWipe")
    body = text[start:]
    for step in CLIENT_WIPE_PHASE_1:
        assert step in body
    assert body.index("dispatchMemoryWipe") < body.index("clearLocalStorageSessionSecrets")
    assert body.index("clearLocalStorageSessionSecrets") < body.index("clearSessionStorageFootprint")


def test_auth_context_delegates_to_orchestrator():
    root = Path(__file__).resolve().parents[2]
    auth = (root / "frontend" / "src" / "context" / "AuthContext.jsx").read_text(encoding="utf-8")
    assert "runPanicOrchestrator" in auth
    assert "runLogoutOrchestrator" in auth
    assert "dispatchMemoryWipe" not in auth
    assert "localStorage.removeItem('ssc_token')" not in auth
    assert "sessionStorage.clear()" not in auth
    assert "registerMemoryWipeHandler" in auth


def test_policy_points_to_orchestrator_module():
    assert ORCHESTRATOR_MODULE.endswith("clientFootprintOrchestrator.js")
    assert len(CLIENT_WIPE_PHASE_1) >= 4


def test_panic_orchestrator_sends_native_app_to_background():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "clientFootprintOrchestrator.js").read_text(encoding="utf-8")
    assert "sendNativeAppToBackground" in text
    assert "App.minimizeApp" in text


def test_session_storage_footprint_module():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "sessionStorageFootprint.js").read_text(encoding="utf-8")
    assert "clearSessionStorageFootprint" in text
    assert "ssc_pending_call" in text
    assert "reason === 'panic'" in text