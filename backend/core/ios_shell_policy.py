"""iOS shell policy — mirrors Android WebView shell — Phase C4."""

from __future__ import annotations

IOS_DEEP_LINK_SCHEME = "ssc"
IOS_DEEP_LINK_HOSTS = frozenset({"link-device", "add"})
IOS_APP_LINK_HOST = "www.supersecurechat.com"

IOS_NATIVE_SHELL_FEATURES = frozenset(
    {
        "splash_screen",
        "deep_links",
        "pull_to_refresh",
        "offline_retry",
        "file_chooser",
        "edge_to_edge",
    }
)


def build_ios_web_path(host: str, path: str = "", query: str = "") -> str:
    host = (host or "").strip().lower()
    path = (path or "").strip().strip("/")
    if host == "link-device":
        return f"/link-device{query}" if query else "/link-device"
    if host == "add" and path:
        return f"/add/{path}"
    return "/"


def step_ios_shell_ready() -> bool:
    return bool(IOS_DEEP_LINK_SCHEME) and bool(IOS_NATIVE_SHELL_FEATURES)