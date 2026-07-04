"""FastAPI router registration."""

from __future__ import annotations

from fastapi import FastAPI

from config import get_settings
from routers.abuse import router as abuse_router
from routers.auth import router as auth_router
from routers.calls import router as calls_router
from routers.config import router as config_router
from routers.conversations import router as conversations_router
from routers.device_link import router as device_link_router
from routers.devices import router as devices_router
from routers.files import router as files_router
from routers.groups import router as groups_router
from routers.health import router as health_router
from routers.messages import router as messages_router
from routers.panic import router as panic_router
from routers.prekeys import router as prekeys_router
from routers.presence import router as presence_router
from routers.privacy import router as privacy_router
from routers.push_router import router as push_router
from routers.sfu import router as sfu_router
from routers.translation import router as translation_router
from routers.ws import router as ws_router


def include_routers(app: FastAPI) -> None:
    settings = get_settings()
    prefix = settings.api_prefix
    app.include_router(health_router, prefix=prefix)
    app.include_router(config_router, prefix=prefix)
    app.include_router(auth_router, prefix=prefix)
    app.include_router(devices_router, prefix=prefix)
    app.include_router(device_link_router, prefix=prefix)
    app.include_router(prekeys_router, prefix=prefix)
    app.include_router(groups_router, prefix=prefix)
    app.include_router(conversations_router, prefix=prefix)
    app.include_router(messages_router, prefix=prefix)
    app.include_router(files_router, prefix=prefix)
    app.include_router(calls_router, prefix=prefix)
    app.include_router(sfu_router, prefix=prefix)
    app.include_router(translation_router, prefix=prefix)
    app.include_router(abuse_router, prefix=prefix)
    app.include_router(presence_router, prefix=prefix)
    app.include_router(privacy_router, prefix=prefix)
    app.include_router(push_router, prefix=prefix)
    app.include_router(panic_router, prefix=prefix)
    app.include_router(ws_router, prefix=prefix)