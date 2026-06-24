"""WebSocket endpoint: messaging, typing, WebRTC signaling."""
import asyncio
import json

from fastapi import Query, WebSocket, WebSocketDisconnect

from core.auth import decode_jwt
from core.ws_tickets import consume_ws_ticket
from core.contact_helpers import are_contacts, has_shared_conv
from core.database import db
from core.logging_config import logger
from core.push_helpers import send_push_for_call
from core.realtime import broadcast_to_conversation, manager
from core.utils import iso, now_utc
from core.webrtc_signaling_policy import SignalingValidationError, validate_signaling_relay


def register_websocket(app):
    @app.websocket("/api/ws")
    async def websocket_endpoint(
        ws: WebSocket,
        ticket: str = Query(""),
        token: str = Query(""),
    ):
        user_id = None
        if ticket:
            user_id = consume_ws_ticket(ticket)
        elif token:
            user_id = decode_jwt(token)
        if not user_id:
            await ws.close(code=4401)
            return
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            await ws.close(code=4404)
            return
        await manager.connect(user_id, ws)
        logger.info(f"WS connected user={user_id}")
        from core.last_seen import touch_last_seen
        await touch_last_seen(db, user_id)
        try:
            await ws.send_text(json.dumps({"type": "connected", "user_id": user_id}))
            while True:
                raw = await ws.receive_text()
                try:
                    data = json.loads(raw)
                except Exception:
                    continue
                t = data.get("type")
                if t == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
                elif t == "typing":
                    conv_id = data.get("conversation_id")
                    if conv_id:
                        await broadcast_to_conversation(conv_id, {
                            "type": "typing",
                            "conversation_id": conv_id,
                            "user_id": user_id,
                            "username": user.get("username"),
                        })
                elif t in ("call-offer", "call-answer", "ice-candidate", "call-end", "call-reject"):
                    to_user = data.get("to")
                    if to_user:
                        group = bool(data.get("group"))
                        if group:
                            can_call = await has_shared_conv(user_id, to_user)
                        else:
                            can_call = await are_contacts(user_id, to_user)
                        if can_call:
                            try:
                                relay_body = validate_signaling_relay(data)
                            except SignalingValidationError as exc:
                                logger.warning(
                                    f"WS signaling rejected user={user_id} type={t}: {exc}"
                                )
                                continue
                            payload = {
                                **relay_body,
                                "from": user_id,
                                "from_username": user.get("username"),
                            }
                            await manager.send_to_user(to_user, payload)
                            if t == "call-offer":
                                mode = data.get("mode", "audio")
                                conv_id = data.get("conversation_id")
                                asyncio.create_task(send_push_for_call(to_user, user, mode, conv_id, group))
                        else:
                            logger.warning(f"WS call blocked: no permission between {user_id} and {to_user}")
                    if data.get("group") and data.get("members"):
                        for m in data.get("members", []):
                            mid = m.get("user_id") if isinstance(m, dict) else m
                            if not await has_shared_conv(user_id, mid):
                                logger.warning(f"WS group call member validation failed for {user_id} and {m}")
                elif t == "read":
                    conv_id = data.get("conversation_id")
                    if conv_id:
                        await broadcast_to_conversation(conv_id, {
                            "type": "read",
                            "conversation_id": conv_id,
                            "user_id": user_id,
                        })
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.warning(f"ws error: {type(e).__name__}")
        finally:
            manager.disconnect(user_id, ws)
            await manager.after_disconnect(user_id)
            logger.info(f"WS disconnected user={user_id}")