"""OAuth finish page — bridges Google redirect back into installed SSC clients."""

from __future__ import annotations

from html import escape

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["oauth-finish"])


def _finish_html(*, oauth_code: str | None, error: str | None) -> str:
    code_js = "null" if not oauth_code else f"'{escape(oauth_code, quote=True)}'"
    err_js = "null" if not error else f"'{escape(error, quote=True)}'"
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
  </style>
</head>
<body>
  <div class="card">
    <h1>Super Secure Chat</h1>
    <p id="status">Returning to the app…</p>
    <p class="muted" id="hint"></p>
  </div>
  <script>
    (function () {{
      const code = {code_js};
      const err = {err_js};
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

      if (isAndroid && !isElectron) {{
        try {{
          window.location.replace(deepLink);
        }} catch (_) {{}}
        status.textContent = 'Returning to Super Secure Chat…';
        return;
      }}

      if (isElectron) {{
        status.textContent = 'Completing sign-in…';
        hint.textContent = 'Returning to Super Secure Chat.';
        return;
      }}

      try {{
        window.location.replace(deepLink);
      }} catch (_) {{}}

      setTimeout(function () {{
        status.textContent = 'Open Super Secure Chat to finish sign-in';
        hint.innerHTML = 'If the app did not open automatically, switch back to SSC on this device.';
      }}, 1800);
    }})();
  </script>
</body>
</html>"""


@router.get("/auth/google", response_class=HTMLResponse)
async def oauth_finish_page(
    oauth_code: str | None = Query(default=None),
    error: str | None = Query(default=None),
) -> HTMLResponse:
    return HTMLResponse(_finish_html(oauth_code=oauth_code, error=error))