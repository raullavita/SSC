"""HTTP middleware: security headers, installed-client gate, abuse limits."""

from __future__ import annotations

import hashlib
import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from config import get_settings
from core.abuse_policy import auth_rate_limiter, feedback_rate_limiter
from core.installed_client_policy import (
    INSTALLED_CLIENT_HEADER,
    validate_request,
)


def add_security_headers(response: Response) -> None:
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if get_settings().is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        add_security_headers(response)
        return response


def _privacy_rate_key(raw_ip: str) -> str:
    """Hash client IP for in-memory rate keys — never store or log raw IPs."""
    salt = os.getenv("SSC_IP_HASH_SALT", "ssc-ip-privacy-v1")
    digest = hashlib.sha256(f"{salt}:{raw_ip}".encode()).hexdigest()
    return digest[:24]


class AbuseRateLimitMiddleware(BaseHTTPMiddleware):
    """Rate-limit auth endpoints per hashed client IP — Engine 8."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"
        ip_key = _privacy_rate_key(client_ip)
        if path.endswith("/auth/login") or path.endswith("/auth/register"):
            if not await auth_rate_limiter.allow(f"auth:{ip_key}"):
                return JSONResponse(status_code=429, content={"detail": "auth_rate_limited"})
        if path.endswith("/public/feedback") and request.method.upper() == "POST":
            if not await feedback_rate_limiter.allow(f"feedback:{ip_key}"):
                return JSONResponse(status_code=429, content={"detail": "feedback_rate_limited"})
        return await call_next(request)


class InstalledClientMiddleware(BaseHTTPMiddleware):
    """Blocks API access without valid installed-client header."""

    async def dispatch(self, request: Request, call_next) -> Response:
        enforce = getattr(request.app.state, "enforce_installed_client", False)
        if not enforce:
            return await call_next(request)

        path = request.url.path
        header_value = request.headers.get(INSTALLED_CLIENT_HEADER)
        ok, detail = validate_request(path, header_value)
        if not ok:
            return JSONResponse(status_code=403, content={"detail": detail})
        return await call_next(request)