"""
SSC - Super Secure Chat Backend
Thin bootstrap: app factory, middleware, router wiring, WebSocket mount.

All business logic lives in core/ and routers/.
"""
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from core.config import CORS_ORIGINS, DB_NAME
from core.database import client, db, grid_fs  # noqa: F401 — init side effects
from core.logging_config import logger
from core.realtime import manager  # noqa: F401 — wires push manager
from lifespan import lifespan
from middleware import setup_middleware
from routers import include_routers
from routers.well_known import router as well_known_router
from routers.ws_handler import register_websocket
from security import validate_environment

validate_environment()
logger.info(f"SSC starting — using database: {DB_NAME} (Mongo Atlas or local)")

app = FastAPI(title="SSC - Super Secure Chat", lifespan=lifespan)
api = APIRouter(prefix="/api")

setup_middleware(app)
include_routers(api)
app.include_router(api)
app.include_router(well_known_router)
register_websocket(app)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Backward-compatible re-exports (tests, scripts) ─────────────────────────
from core.auth import decode_jwt, get_current_user, make_jwt  # noqa: E402
from core.contact_helpers import are_contacts, get_user_public, has_shared_conv  # noqa: E402
from core.push_helpers import (  # noqa: E402
    send_push_for_call,
    send_push_for_friend_accept,
    send_push_for_friend_request,
    send_push_for_group_added,
    send_push_for_message,
    send_push_for_status,
)
from core.realtime import broadcast_to_conversation  # noqa: E402
from core.utils import iso, now_utc, validate_username  # noqa: E402

__all__ = [
    "app",
    "api",
    "db",
    "client",
    "grid_fs",
    "manager",
    "get_current_user",
    "decode_jwt",
    "make_jwt",
    "iso",
    "now_utc",
    "validate_username",
    "are_contacts",
    "has_shared_conv",
    "get_user_public",
    "broadcast_to_conversation",
    "send_push_for_message",
    "send_push_for_call",
    "send_push_for_friend_request",
    "send_push_for_friend_accept",
    "send_push_for_status",
    "send_push_for_group_added",
]