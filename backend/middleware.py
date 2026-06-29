"""FastAPI middleware and exception handlers."""
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import os

from core.logging_config import logger
from core.logging_policy import format_client_ip, safe_request_path


def setup_middleware(app: FastAPI):
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        path = safe_request_path(request.url.path)
        logger.warning(f"validation error on {path}: {len(exc.errors())} field(s)")
        return JSONResponse(
            status_code=422,
            content={"detail": "Invalid input", "errors": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(f"unhandled error on {safe_request_path(request.url.path)}: {type(exc).__name__}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(self), microphone=(self), geolocation=(self)"
        if os.environ.get("ENV", "development").lower() == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; frame-ancestors 'none'; base-uri 'self'"
            )
        return response

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        client = format_client_ip(request.client.host if request.client else None)
        path = safe_request_path(request.url.path)
        logger.info(
            f"[{request_id}] {request.method} {path} "
            f"status={response.status_code} time_ms={process_time:.1f} "
            f"client={client}"
        )
        return response