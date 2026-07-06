"""SSC backend entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from core.release_policy import RELEASE_VERSION
from core.firebase_init import ensure_firebase
from core.lifespan import bootstrap_database
from core.rate_limit import require_redis_for_production_rate_limits
from core.session_production import validate_production_redis
from core.startup_gates import validate_production_startup
from core.ws_hub import ws_hub
from db import close_connections, get_database
from middleware import AbuseRateLimitMiddleware, InstalledClientMiddleware, SecurityHeadersMiddleware
from routers import include_routers

logger = logging.getLogger("ssc")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    validate_production_startup(settings)
    await validate_production_redis(settings)
    await require_redis_for_production_rate_limits(settings.is_production)
    ensure_firebase()
    db = get_database()
    try:
        await bootstrap_database(db)
        await ws_hub.start_redis_listener()
    except Exception as exc:
        if settings.is_production:
            raise RuntimeError(f"production_bootstrap_failed: {exc}") from exc
        logger.warning("bootstrap skipped (dev): %s", exc)
    yield
    await close_connections()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SSC - Super Secure Chat",
        version=RELEASE_VERSION,
        lifespan=lifespan,
    )
    app.state.enforce_installed_client = settings.enforce_installed_client

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-SSC-Client",
            "X-SSC-Native-Bridge",
            "X-SSC-Device-Attest",
            "Accept",
            "Origin",
        ],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AbuseRateLimitMiddleware)
    app.add_middleware(InstalledClientMiddleware)

    include_routers(app)
    return app


app = create_app()