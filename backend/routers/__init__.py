"""FastAPI router registration."""

from __future__ import annotations

from fastapi import FastAPI

from config import get_settings
from routers.health import router as health_router


def include_routers(app: FastAPI) -> None:
    settings = get_settings()
    app.include_router(health_router, prefix=settings.api_prefix)