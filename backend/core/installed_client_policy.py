"""Installed-client-only product policy — SSC never runs as a browser-tab app."""
from __future__ import annotations

from typing import Tuple

from fastapi import HTTPException, Request

from core.auth import is_installed_client_request

BROWSER_PRODUCT_SURFACE_ALLOWED = False

ALLOWED_PLATFORMS: Tuple[str, ...] = ("android", "ios", "windows", "mac")

# Public read-only API paths (uptime monitors + marketing status page).
BROWSER_ALLOWED_API_PATHS: Tuple[str, ...] = (
    "/api",
    "/api/",
    "/api/health",
    "/api/config",
    "/api/status",
)

INSTALLED_CLIENT_REQUIRED_DETAIL = (
    "installed_client_required: SSC works only in the installed "
    "Android, iOS, Windows, or Mac app"
)


def path_allows_browser_api(path: str) -> bool:
    normalized = (path or "").rstrip("/") or "/"
    if normalized in BROWSER_ALLOWED_API_PATHS:
        return True
    if normalized.startswith("/.well-known"):
        return True
    return False


def should_block_browser_api_request(request: Request) -> bool:
    if BROWSER_PRODUCT_SURFACE_ALLOWED:
        return False
    if request.method.upper() == "OPTIONS":
        return False
    if is_installed_client_request(request):
        return False
    path = request.url.path or ""
    if not path.startswith("/api"):
        return False
    return not path_allows_browser_api(path)


def enforce_installed_client_api(request: Request) -> None:
    if should_block_browser_api_request(request):
        raise HTTPException(403, INSTALLED_CLIENT_REQUIRED_DETAIL)


def installed_client_public_config() -> dict:
    return {
        "browser_product_surface_allowed": BROWSER_PRODUCT_SURFACE_ALLOWED,
        "allowed_platforms": list(ALLOWED_PLATFORMS),
        "required_header": "X-SSC-Client: installed",
    }