"""WebSocket endpoint — cookie or bearer session auth (Engine 5)."""

from __future__ import annotations

import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from core.auth_tokens import decode_access_token
from core.session_policy import SESSION_COOKIE_NAME
from core.token_revocation import is_session_revoked
from core.ws_hub import ws_hub

router = APIRouter(tags=["websocket"])


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


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(default=None),
) -> None:
    cookie_token = websocket.cookies.get(SESSION_COOKIE_NAME)
    auth_token = token or cookie_token
    user_id = await _authenticate_ws_token(auth_token)
    if not user_id:
        await websocket.close(code=4401)
        return

    await ws_hub.connect(websocket, user_id)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "detail": "invalid_json"}))
                continue

            if data.get("type") == "subscribe":
                topic = data.get("topic")
                if isinstance(topic, str) and (
                    topic.startswith("conversation:") or topic == f"user:{user_id}"
                ):
                    await ws_hub.subscribe(websocket, topic)
                    await websocket.send_text(json.dumps({"type": "subscribed", "topic": topic}))
                else:
                    await websocket.send_text(json.dumps({"type": "error", "detail": "invalid_topic"}))
    except WebSocketDisconnect:
        pass
    finally:
        await ws_hub.disconnect(websocket, user_id)