"""Android shell policy — Step 17. Native UX polish around the WebView installed client."""

from __future__ import annotations

ANDROID_DEEP_LINK_SCHEME = "ssc"
ANDROID_DEEP_LINK_HOSTS = frozenset({"link-device", "add", "auth"})
ANDROID_APP_LINK_HOST = "www.supersecurechat.com"

NATIVE_SHELL_FEATURES = frozenset(
    {
        "splash_screen",
        "deep_links",
        "pull_to_refresh",
        "offline_retry",
        "file_chooser",
        "edge_to_edge",
    }
)


def build_android_web_path(host: str, path: str = "", query: str = "") -> str:
    """Map ssc:// host + path to a web-shell route."""
    host = (host or "").strip().lower()
    path = (path or "").strip().strip("/")
    if host == "link-device":
        return f"/link-device{query}" if query else "/link-device"
    if host == "add" and path:
        return f"/add/{path}"
    if host == "auth":
        if path:
            return f"/auth/{path}{query}" if query else f"/auth/{path}"
        return f"/auth{query}" if query else "/auth"
    return "/"


def step17_android_shell_ready() -> bool:
    return bool(ANDROID_DEEP_LINK_SCHEME) and bool(NATIVE_SHELL_FEATURES)