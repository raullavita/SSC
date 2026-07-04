"""SSC backend entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from db import close_connections
from middleware import InstalledClientMiddleware, SecurityHeadersMiddleware
from routers import include_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_connections()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SSC - Super Secure Chat",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.enforce_installed_client = False

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