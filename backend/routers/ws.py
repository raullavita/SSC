"""WebSocket endpoint — Engine 3."""

from __future__ import annotations

import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from core.auth_tokens import decode_access_token
from core.ws_hub import ws_hub

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        await websocket.close(code=4401)
        return

    user_id = str(payload["sub"])
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
                if isinstance(topic, str) and topic.startswith("conversation:"):
                    await ws_hub.subscribe(websocket, topic)
                    await websocket.send_text(json.dumps({"type": "subscribed", "topic": topic}))
                else:
                    await websocket.send_text(json.dumps({"type": "error", "detail": "invalid_topic"}))
    except WebSocketDisconnect:
        pass
    finally:
        await ws_hub.disconnect(websocket, user_id)