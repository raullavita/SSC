"""OAuth finish page — bridges Google redirect back into installed SSC clients."""

from __future__ import annotations

from html import escape
from urllib.parse import quote

from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["oauth-finish"])

_ANDROID_PKG = "com.supersecurechat.app"


def _is_android_custom_tab(user_agent: str) -> bool:
    ua = user_agent or ""
    return "Android" in ua and "Electron" not in ua


def _intent_link(oauth_code: str) -> str:
    encoded = quote(oauth_code, safe="")
    return (
        f"intent://auth/google?oauth_code={encoded}"
        f"#Intent;scheme=ssc;package={_ANDROID_PKG}"
        ";action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end"
    )


def _deep_link(oauth_code: str) -> str:
    return f"ssc://auth/google?oauth_code={quote(oauth_code, safe='')}"


def _android_button_html(oauth_code: str) -> str:
    intent = escape(_intent_link(oauth_code), quote=True)
    return (
        f'<a class="btn" id="open-ssc" href="{intent}">Open Super Secure Chat</a>'
        '<span class="muted">Tap the button to return to the app and finish sign-in.</span>'
    )


def _finish_html(
    *,
    oauth_code: str | None,
    error: str | None,
    is_android: bool = False,
) -> str:
    code_js = "null" if not oauth_code else f"'{escape(oauth_code, quote=True)}'"
    err_js = "null" if not error else f"'{escape(error, quote=True)}'"
    android_ready = bool(is_android and oauth_code and not error)
    status_text = "Google sign-in complete" if android_ready else "Returning to the app…"
    hint_html = _android_button_html(oauth_code) if android_ready else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SSC — Google sign-in</title>
  <style>
    body {{
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #0b141a; color: #e9edef; font-family: system-ui, sans-serif; padding: 2rem;
      text-align: center;
    }}
    .card {{ max-width: 28rem; }}
    .muted {{ color: #8696a0; margin-top: 1rem; font-size: 0.95rem; }}
    a {{ color: #00a884; }}
    .btn {{
      display: inline-block; margin-top: 1.25rem; padding: 0.9rem 1.4rem;
      background: #00a884; color: #0b141a; font-weight: 600; text-decoration: none;
      border-radius: 0.5rem; font-size: 1rem;
    }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Super Secure Chat</h1>
    <p id="status">{escape(status_text)}</p>
    <div class="muted" id="hint">{hint_html}</div>
  </div>
  <script>
    (function () {{
      const code = {code_js};
      const err = {err_js};
      const serverAndroid = {"true" if android_ready else "false"};
      const status = document.getElementById('status');
      const hint = document.getElementById('hint');

      if (err) {{
        status.textContent = 'Google sign-in failed';
        hint.textContent = err;
        return;
      }}
      if (!code) {{
        status.textContent = 'Missing sign-in code';
        hint.textContent = 'Close this tab and try again from the SSC app.';
        return;
      }}

      const deepLink = 'ssc://auth/google?oauth_code=' + encodeURIComponent(code);
      const isElectron = /Electron/i.test(navigator.userAgent || '');
      const isAndroid = /Android/i.test(navigator.userAgent || '');
      const pkg = '{_ANDROID_PKG}';
      const intentLink =
        'intent://auth/google?oauth_code=' + encodeURIComponent(code) +
        '#Intent;scheme=ssc;package=' + pkg +
        ';action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end';

      if (serverAndroid || (isAndroid && !isElectron)) {{
        status.textContent = 'Google sign-in complete';
        hint.innerHTML =
          '<a class="btn" id="open-ssc" href="' + intentLink + '">Open Super Secure Chat</a>' +
          '<p class="muted">Tap the button to return to the app and finish sign-in.</p>';
        return;
      }}

      window.location.replace(deepLink);
      hint.innerHTML =
        '<a id="open-ssc" href="' + deepLink + '">Tap here if the app does not open</a>';

      setTimeout(function () {{
        status.textContent = 'Open Super Secure Chat to finish sign-in';
        hint.innerHTML =
          '<a id="open-ssc" href="' + deepLink + '">Tap here to return to SSC</a>';
      }}, 1200);
    }})();
  </script>
</body>
</html>"""


@router.get("/auth/google", response_class=HTMLResponse)
async def oauth_finish_page(
    request: Request,
    oauth_code: str | None = Query(default=None),
    error: str | None = Query(default=None),
) -> HTMLResponse:
    ua = request.headers.get("user-agent", "")
    return HTMLResponse(
        _finish_html(
            oauth_code=oauth_code,
            error=error,
            is_android=_is_android_custom_tab(ua),
        )
    )