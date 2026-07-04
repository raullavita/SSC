"""FastAPI router registration."""

from __future__ import annotations

from fastapi import FastAPI

from config import get_settings
from routers.auth import router as auth_router
from routers.config import router as config_router
from routers.conversations import router as conversations_router
from routers.health import router as health_router
from routers.messages import router as messages_router
from routers.panic import router as panic_router
from routers.ws import router as ws_router


def include_routers(app: FastAPI) -> None:
    settings = get_settings()
    prefix = settings.api_prefix
    app.include_router(health_router, prefix=prefix)
    app.include_router(config_router, prefix=prefix)
    app.include_router(auth_router, prefix=prefix)
    app.include_router(conversations_router, prefix=prefix)
    app.include_router(messages_router, prefix=prefix)
    app.include_router(panic_router, prefix=prefix)
    app.include_router(ws_router, prefix=prefix)