"""SSC backend entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from core.firebase_init import ensure_firebase
from core.lifespan import bootstrap_database
from core.session_production import validate_production_redis
from core.ws_hub import ws_hub
from db import close_connections, get_database
from middleware import AbuseRateLimitMiddleware, InstalledClientMiddleware, SecurityHeadersMiddleware
from routers import include_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    await validate_production_redis(settings)
    ensure_firebase()
    db = get_database()
    try:
        await bootstrap_database(db)
        await ws_hub.start_redis_listener()
    except Exception:
        pass  # dev without Mongo — health endpoint reports degraded
    yield
    await close_connections()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SSC - Super Secure Chat",
        version="0.3.0",
        lifespan=lifespan,
    )
    app.state.enforce_installed_client = settings.enforce_installed_client

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AbuseRateLimitMiddleware)
    app.add_middleware(InstalledClientMiddleware)

    include_routers(app)
    return app


app = create_app()