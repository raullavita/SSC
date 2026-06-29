"""Register all API routers on the shared /api prefix."""
from fastapi import APIRouter

from routers.auth import router as auth_router
from routers.config_route import router as config_router
from routers.broadcast_lists import router as broadcast_lists_router
from routers.contacts import router as contacts_router
from routers.conversations import router as conversations_router
from routers.files import router as files_router
from routers.health import router as health_router
from routers.keys import router as keys_router
from routers.messages import router as messages_router
from routers.panic import router as panic_router
from routers.push_routes import router as push_router
from routers.retention import router as retention_router
from routers.statuses import router as statuses_router
from routers.translate import router as translate_router
from routers.users import router as users_router


def include_routers(api: APIRouter):
    api.include_router(health_router)
    api.include_router(config_router)
    api.include_router(auth_router, prefix="/auth")
    api.include_router(users_router, prefix="/users")
    api.include_router(contacts_router, prefix="/contacts")
    api.include_router(broadcast_lists_router, prefix="/broadcast-lists")
    api.include_router(conversations_router, prefix="/conversations")
    api.include_router(messages_router, prefix="/messages")
    api.include_router(translate_router, prefix="/translate")
    api.include_router(files_router, prefix="/files")
    api.include_router(panic_router)
    api.include_router(push_router, prefix="/push")
    api.include_router(retention_router)
    api.include_router(statuses_router, prefix="/statuses")
    api.include_router(keys_router, prefix="/keys")