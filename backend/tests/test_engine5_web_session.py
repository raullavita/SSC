"""Engine 5 Step 5.3 — web client cookie auth (source enforcement)."""
from pathlib import Path

from core.google_auth import frontend_redirect
from core.session_policy import ENGINE5_STEPS

REPO = Path(__file__).resolve().parents[2]
FRONTEND = REPO / "frontend" / "src"


def test_engine5_step_5_3_marked_complete():
    done = {step_id: complete for step_id, _, complete in ENGINE5_STEPS}
    assert done["5.3"] is True


def test_session_store_module_exists():
    text = (FRONTEND / "lib" / "sessionStore.js").read_text(encoding="utf-8")
    assert "usesCookieAuth" in text
    assert "return false" in text
    assert "persistSessionToken" in text
    assert "purgeLegacyJwtFromStorage" in text


def test_api_js_no_cookie_auth():
    text = (FRONTEND / "lib" / "api.js").read_text(encoding="utf-8")
    assert "withCredentials: false" in text
    assert "localStorage.getItem('ssc_token')" not in text
    assert "localStorage.getItem(\"ssc_token\")" not in text


def test_auth_context_no_localstorage_jwt_on_web():
    text = (FRONTEND / "context" / "AuthContext.jsx").read_text(encoding="utf-8")
    assert "persistSessionToken" in text
    assert "localStorage.setItem('ssc_token'" not in text
    assert "purgeLegacyJwtFromStorage" in text


def test_google_callback_installed_exchanges_code():
    text = (FRONTEND / "pages" / "GoogleAuthCallback.jsx").read_text(encoding="utf-8")
    assert "isInstalledClient()" in text
    assert "/auth/google/exchange" in text
    assert "oauth_code" in text
    assert "persistSessionToken" in text
    assert "localStorage.setItem('ssc_token'" not in text


def test_orchestrator_cookie_logout_on_web():
    text = (FRONTEND / "lib" / "clientFootprintOrchestrator.js").read_text(encoding="utf-8")
    assert "usesBearerAuth" in text


def test_google_native_redirect_uses_android_deep_link_scheme():
    url = frontend_redirect("native", "tok", False)
    assert url.startswith("chat.ssc.secure://app/auth/google")
    assert "https://localhost" not in url


def test_google_native_redirect_uses_oauth_code_not_jwt():
    url = frontend_redirect("native", "native_tok", True)
    assert "native_tok" not in url
    assert "oauth_code=" in url
    assert "needs_setup=1" in url
    assert "/auth/google" in url


def test_google_desktop_redirect_uses_desktop_scheme():
    url = frontend_redirect("desktop", "desk_tok", False)
    assert "desk_tok" not in url
    assert "oauth_code=" in url
    assert "needs_setup=0" in url
    assert "chat.ssc.secure.desktop://" in url


def test_oauth_completion_code_roundtrip():
    from core.oauth_completion import exchange_oauth_completion_code, issue_oauth_completion_code

    code = issue_oauth_completion_code("session_jwt_xyz")
    assert code
    token = exchange_oauth_completion_code(code)
    assert token == "session_jwt_xyz"
    assert exchange_oauth_completion_code(code) is None


def test_android_manifest_oauth_deep_link_intent():
    manifest = (REPO / "frontend" / "android" / "app" / "src" / "main" / "AndroidManifest.xml").read_text(
        encoding="utf-8"
    )
    assert 'android:scheme="chat.ssc.secure"' in manifest
    assert 'android:host="app"' in manifest
    assert 'android:pathPrefix="/auth"' in manifest


def test_capacitor_deep_link_without_full_reload():
    cap = (FRONTEND / "lib" / "capacitor-init.js").read_text(encoding="utf-8")
    assert "dispatchDeepLink" in cap
    assert "window.location.assign" not in cap
    deep = (FRONTEND / "lib" / "deepLink.js").read_text(encoding="utf-8")
    assert "ssc-deep-link" in deep
    app = (FRONTEND / "App.js").read_text(encoding="utf-8")
    assert "DeepLinkListener" in app


def test_protected_recovers_session_when_token_present():
    text = (FRONTEND / "App.js").read_text(encoding="utf-8")
    assert "sessionRecovery" in text
    assert "getSessionToken()" in text
    assert "refreshUser()" in text


def test_google_password_account_not_auto_linked():
    text = (REPO / "backend" / "routers" / "auth.py").read_text(encoding="utf-8")
    assert 'auth_provider") == "password"' in text or "auth_provider'] == 'password'" in text
    assert "password account" in text
    assert "409" in text


def test_complete_google_auth_awaits_refresh_user():
    text = (FRONTEND / "lib" / "google-auth.js").read_text(encoding="utf-8")
    assert "await refreshUser()" in text