"""Capture SSC Electron UI via Chrome DevTools Protocol (remote debugging)."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

try:
    import websocket  # type: ignore
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "websocket-client"])
    import websocket  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "audit-reports" / "app-screenshots"
OUT.mkdir(parents=True, exist_ok=True)
CDP_HOST = "http://127.0.0.1:9222"


def _assert_local_cdp(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("CDP host must be localhost HTTP")


class Cdp:
    def __init__(self, ws_url: str) -> None:
        self._id = 0
        self._ws = websocket.create_connection(ws_url, timeout=30)
        self._ws.settimeout(30)

    def call(self, method: str, params: dict | None = None) -> dict:
        self._id += 1
        payload = {"id": self._id, "method": method, "params": params or {}}
        self._ws.send(json.dumps(payload))
        while True:
            raw = self._ws.recv()
            msg = json.loads(raw)
            if msg.get("id") == self._id:
                if "error" in msg:
                    raise RuntimeError(msg["error"])
                return msg.get("result", {})

    def close(self) -> None:
        self._ws.close()


def get_page_ws() -> str:
    _assert_local_cdp(CDP_HOST)
    with httpx.Client(timeout=5.0) as client:
        pages = client.get(f"{CDP_HOST}/json/list").json()
    for page in pages:
        if page.get("type") == "page":
            return page["webSocketDebuggerUrl"]
    raise RuntimeError("No CDP page target found — launch app with --remote-debugging-port=9222")


def snapshot(cdp: Cdp, name: str) -> dict:
    layout = cdp.call("Page.getLayoutMetrics")
    content = layout.get("contentSize", {})
    height = int(content.get("height", 800))
    viewport = layout.get("visualViewport", {})
    vw = int(viewport.get("clientWidth", 1200))
    vh = int(viewport.get("clientHeight", 800))

    cdp.call("Page.captureScreenshot", {"format": "png", "fromSurface": True})
    shot = cdp.call("Page.captureScreenshot", {"format": "png", "fromSurface": True})
    png = shot.get("data", "")
    if png:
        import base64

        (OUT / f"{name}.png").write_bytes(base64.b64decode(png))

    scroll_positions = [0]
    if height > vh + 40:
        step = max(vh - 80, 400)
        pos = 0
        while pos < height - vh:
            pos += step
            scroll_positions.append(pos)
        scroll_positions.append(max(0, height - vh))

    texts: list[str] = []
    for i, y in enumerate(scroll_positions):
        cdp.call("Runtime.evaluate", {"expression": f"window.scrollTo(0, {y})"})
        time.sleep(0.35)
        shot = cdp.call("Page.captureScreenshot", {"format": "png", "fromSurface": True})
        if shot.get("data"):
            import base64

            (OUT / f"{name}-scroll{i}.png").write_bytes(base64.b64decode(shot["data"]))
        body = cdp.call(
            "Runtime.evaluate",
            {
                "expression": """(() => {
                  const t = document.body?.innerText || '';
                  const route = window.location?.hash || window.location?.pathname || '';
                  const inputs = [...document.querySelectorAll('input,textarea,button,a')].slice(0,80)
                    .map(el => `${el.tagName}:${el.type||''}:${(el.placeholder||el.textContent||'').trim().slice(0,60)}`);
                  return JSON.stringify({ route, text: t.slice(0,8000), controls: inputs });
                })()""",
                "returnByValue": True,
            },
        )
        val = body.get("result", {}).get("value")
        if val:
            texts.append(json.loads(val))

    merged = texts[0] if texts else {"route": "", "text": "", "controls": []}
    (OUT / f"{name}.json").write_text(json.dumps(merged, indent=2), encoding="utf-8")
    return {"name": name, "viewport": f"{vw}x{vh}", "content_height": height, **merged}


def navigate(cdp: Cdp, hash_path: str, name: str, base_url: str) -> dict:
    url = base_url.split("#")[0].rstrip("/") + hash_path
    cdp.call("Page.navigate", {"url": url})
    time.sleep(2.0)
    return snapshot(cdp, name)


def main() -> int:
    ws = get_page_ws()
    cdp = Cdp(ws)
    try:
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")
        _assert_local_cdp(CDP_HOST)
        with httpx.Client(timeout=5.0) as client:
            page_url = client.get(f"{CDP_HOST}/json/list").json()[0]["url"]
        reports = [
            snapshot(cdp, "ssc-landing"),
            navigate(cdp, "#/login", "ssc-login", page_url),
            navigate(cdp, "#/recovery", "ssc-recovery", page_url),
            navigate(cdp, "#/chat", "ssc-chat", page_url),
            navigate(cdp, "#/settings", "ssc-settings", page_url),
        ]
        print(json.dumps(reports, indent=2))
        print(f"\nScreenshots saved under {OUT}")
        return 0
    finally:
        cdp.close()


if __name__ == "__main__":
    raise SystemExit(main())