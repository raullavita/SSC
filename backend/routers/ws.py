"""WebSocket endpoint — cookie or first-frame session auth (Phase 1)."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from config import get_settings
from core.auth_tokens import decode_access_token
from core.session_policy import SESSION_COOKIE_NAME
from core.token_revocation import is_session_revoked
from core.ws_hub import ws_hub
from core.ws_subscribe_tokens import (
    consume_subscribe_token,
    validate_topic_for_user,
    ws_subscribe_token_required,
)

router = APIRouter(tags=["websocket"])

_AUTH_FRAME_TIMEOUT_SEC = 10.0


async def _authenticate_ws_token(token: str | None) -> str | None:
    if not token or not token.strip():
        return None
    payload = decode_access_token(token.strip())
    if not payload or not payload.get("sub"):
        return None
    jti = payload.get("jti")
    if jti and await is_session_revoked(jti):
        return None
    return str(payload["sub"])


async def _resolve_ws_user_id(
    websocket: WebSocket,
    *,
    query_token: str | None,
) -> tuple[str | None, bool]:
    """Return (user_id, websocket_already_accepted)."""
    settings = get_settings()
    cookie_token = websocket.cookies.get(SESSION_COOKIE_NAME)
    user_id = await _authenticate_ws_token(cookie_token)
    if user_id:
        return user_id, False

    if not settings.is_production and query_token:
        user_id = await _authenticate_ws_token(query_token)
        if user_id:
            return user_id, False

    await websocket.accept()
    try:
        raw = await asyncio.wait_for(
            websocket.receive_text(),
            timeout=_AUTH_FRAME_TIMEOUT_SEC,
        )
        data = json.loads(raw)
    except (asyncio.TimeoutError, json.JSONDecodeError, WebSocketDisconnect):
        return None, True

    if data.get("type") != "auth":
        return None, True
    user_id = await _authenticate_ws_token(data.get("token"))
    return user_id, True


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(default=None),
) -> None:
    if get_settings().is_production and token:
        await websocket.close(code=4401)
        return

    user_id, accepted = await _resolve_ws_user_id(websocket, query_token=token)
    if not user_id:
        if accepted:
            await websocket.close(code=4401)
        else:
            await websocket.close(code=4401)
        return

    if accepted:
        await ws_hub.register(websocket, user_id)
    else:
        await ws_hub.connect(websocket, user_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "detail": "invalid_json"}))
                continue

            if data.get("type") == "auth":
                continue

            if data.get("type") == "subscribe":
                topic = data.get("topic")
                if not isinstance(topic, str) or not await validate_topic_for_user(topic, user_id):
                    await websocket.send_text(json.dumps({"type": "error", "detail": "invalid_topic"}))
                    continue
                if ws_subscribe_token_required():
                    sub_token = data.get("subscribe_token")
                    if not await consume_subscribe_token(sub_token, user_id, topic):
                        await websocket.send_text(
                            json.dumps({"type": "error", "detail": "subscribe_token_invalid"})
                        )
                        continue
                await ws_hub.subscribe(websocket, topic)
                await websocket.send_text(json.dumps({"type": "subscribed", "topic": topic}))
    except WebSocketDisconnect:
        pass
    finally:
        await ws_hub.disconnect(websocket, user_id)