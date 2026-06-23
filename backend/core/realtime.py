"""WebSocket manager and conversation broadcast."""
import push as push_module
from ws import ConnectionManager

from core.database import db

manager = ConnectionManager()
push_module.manager = manager


async def broadcast_to_conversation(conversation_id: str, payload: dict):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv:
        return
    for uid in conv["participants"]:
        await manager.send_to_user(uid, payload)


async def broadcast_message_to_conversation(conversation_id: str, msg: dict):
    """WebSocket message events — per-recipient key projection (Engine 2.4)."""
    from core.api_integrity import project_message_for_viewer

    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv:
        return
    for uid in conv["participants"]:
        await manager.send_to_user(uid, {
            "type": "message",
            "data": project_message_for_viewer(msg, uid),
        })