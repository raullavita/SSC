"""HTTP middleware: security headers and installed-client gate (Engine 2 stub)."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

INSTALLED_CLIENT_HEADER = "X-SSC-Client"
HEALTH_PATHS = {"/api/health", "/api/health/"}


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


class InstalledClientMiddleware(BaseHTTPMiddleware):
    """Blocks API access without installed-client header (Engine 2 — enabled in Phase 1)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path.rstrip("/") or "/"
        if not path.startswith("/api"):
            return await call_next(request)
        if path in HEALTH_PATHS or path == "/api/health":
            return await call_next(request)

        # Phase 0: enforcement disabled until Engine 2; header check wired for tests.
        enforce = request.app.state.enforce_installed_client
        if enforce and not request.headers.get(INSTALLED_CLIENT_HEADER):
            return JSONResponse(
                status_code=403,
                content={
                    "detail": (
                        "installed_client_required: SSC works only in the "
                        "installed Android, iOS, Windows, or Mac app"
                    )
                },
            )
        return await call_next(request)