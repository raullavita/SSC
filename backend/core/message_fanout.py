"""Message fanout — conversation + multi-device user topics — Engine 9."""

from __future__ import annotations

from typing import Any

from core.metadata_policy import public_message
from core.ws_hub import ws_hub


async def fanout_message(
    conversation_id: str,
    doc: dict[str, Any],
    participants: list[str],
    sender_id: str,
) -> None:
    message = public_message(doc, viewer_id=None)
    await ws_hub.publish(
        f"conversation:{conversation_id}",
        {
            "type": "message",
            "message": message,
            "participants": participants,
        },
    )

    for uid in participants:
        viewer_message = public_message(doc, viewer_id=uid)
        await ws_hub.publish(
            f"user:{uid}",
            {
                "type": "sync_message",
                "message": viewer_message,
                "conversation_id": conversation_id,
            },
        )