"""Google OAuth2 — installed clients only (Android + desktop). No browser-tab redirect flow."""
import hmac
import os
from hashlib import sha256
from urllib.parse import urlencode

import requests
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from core.config import JWT_SECRET

GOOGLE_CLIENT_ID = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
GOOGLE_CLIENT_SECRET = (os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()
GOOGLE_REDIRECT_URI = (os.environ.get("GOOGLE_REDIRECT_URI") or "").strip()
# Capacitor Android WebView origin (installed app shell — not a browser tab).
NATIVE_OAUTH_REDIRECT = (os.environ.get("NATIVE_OAUTH_REDIRECT") or "https://localhost").rstrip("/")
DESKTOP_OAUTH_REDIRECT = (os.environ.get("DESKTOP_OAUTH_REDIRECT") or "chat.ssc.secure.desktop://auth").rstrip("/")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

INSTALLED_PLATFORMS = frozenset({"native", "desktop"})


def is_configured() -> bool:
    from core.egress_policy import egress_feature_enabled

    if not egress_feature_enabled("google_oauth"):
        return False
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI)


def public_client_id() -> str:
    return GOOGLE_CLIENT_ID


def verify_id_token(token: str) -> dict:
    if not GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID not set")
    claims = google_id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        GOOGLE_CLIENT_ID,
        clock_skew_in_seconds=120,
    )
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Invalid token issuer")
    if not claims.get("email_verified"):
        raise ValueError("Google email not verified")
    return claims


def make_state(platform: str) -> str:
    sig = hmac.new(JWT_SECRET.encode(), platform.encode(), sha256).hexdigest()[:16]
    return f"{platform}:{sig}"


def parse_state(state: str) -> str:
    if not state or ":" not in state:
        return "native"
    platform, sig = state.split(":", 1)
    expected = hmac.new(JWT_SECRET.encode(), platform.encode(), sha256).hexdigest()[:16]
    if not hmac.compare_digest(sig, expected):
        return "native"
    return platform if platform in INSTALLED_PLATFORMS else "native"


def authorization_url(platform: str = "native") -> str:
    if platform not in INSTALLED_PLATFORMS:
        raise ValueError(f"Unsupported OAuth platform: {platform}")
    if not is_configured():
        raise ValueError("Google OAuth not configured")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": make_state(platform),
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    if not is_configured():
        raise ValueError("Google OAuth not configured")
    r = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    if r.status_code != 200:
        raise ValueError(f"Token exchange failed: {r.text[:200]}")
    return r.json()


def _installed_oauth_base(platform: str) -> str:
    if platform == "desktop":
        return DESKTOP_OAUTH_REDIRECT
    return NATIVE_OAUTH_REDIRECT


def frontend_redirect(platform: str, token: str, needs_setup: bool) -> str:
    """Redirect into installed app with one-time oauth_code (JWT never in URL)."""
    from core.oauth_completion import issue_oauth_completion_code

    if platform not in INSTALLED_PLATFORMS:
        platform = "native"
    oauth_code = issue_oauth_completion_code(token)
    q = urlencode({"oauth_code": oauth_code, "needs_setup": "1" if needs_setup else "0"})
    base = _installed_oauth_base(platform)
    return f"{base}/auth/google?{q}"