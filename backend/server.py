"""SSC backend entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from core.lifespan import bootstrap_database
from db import close_connections, get_database
from middleware import InstalledClientMiddleware, SecurityHeadersMiddleware
from routers import include_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_database()
    try:
        await bootstrap_database(db)
    except Exception:
        pass  # dev without Mongo — health endpoint reports degraded
    yield
    await close_connections()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SSC - Super Secure Chat",
        version="0.1.0",
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
    app.add_middleware(InstalledClientMiddleware)

    include_routers(app)
    return app


app = create_app()