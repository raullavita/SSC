"""HTTP middleware: security headers, installed-client gate, abuse limits."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.abuse_policy import auth_rate_limiter
from core.installed_client_policy import (
    INSTALLED_CLIENT_HEADER,
    validate_request,
)


def add_security_headers(response: Response) -> None:
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        add_security_headers(response)
        return response


class AbuseRateLimitMiddleware(BaseHTTPMiddleware):
    """Rate-limit auth endpoints per client IP — Engine 8."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if path.endswith("/auth/login") or path.endswith("/auth/register"):
            client_ip = request.client.host if request.client else "unknown"
            if not auth_rate_limiter.allow(f"auth:{client_ip}"):
                return JSONResponse(status_code=429, content={"detail": "auth_rate_limited"})
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