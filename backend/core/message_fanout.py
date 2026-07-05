"""Message fanout — conversation + multi-device user topics — Engine 9."""

from __future__ import annotations

from typing import Any

from core.metadata_policy import public_message, scrub_payload
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
        scrub_payload(
            {
                "type": "message",
                "message": message,
            }
        ),
    )

    for uid in participants:
        viewer_message = public_message(doc, viewer_id=uid)
        await ws_hub.publish(
            f"user:{uid}",
            scrub_payload(
                {
                    "type": "sync_message",
                    "message": viewer_message,
                    "conversation_id": conversation_id,
                }
            ),
        )


async def fanout_message_edited(
    conversation_id: str,
    doc: dict[str, Any],
    participants: list[str],
) -> None:
    message = public_message(doc, viewer_id=None)
    payload = scrub_payload({"type": "message_edited", "message": message})
    await ws_hub.publish(f"conversation:{conversation_id}", payload)
    for uid in participants:
        viewer_message = public_message(doc, viewer_id=uid)
        await ws_hub.publish(
            f"user:{uid}",
            scrub_payload(
                {
                    "type": "message_edited",
                    "message": viewer_message,
                    "conversation_id": conversation_id,
                }
            ),
        )


async def fanout_message_deleted(
    conversation_id: str,
    message_id: str,
    scope: str,
    actor_id: str,
    participants: list[str],
    doc: dict[str, Any] | None = None,
) -> None:
    base: dict[str, Any] = {
        "type": "message_deleted",
        "message_id": message_id,
        "conversation_id": conversation_id,
        "scope": scope,
    }
    if scope == "everyone" and doc:
        base["message"] = public_message(doc, viewer_id=None)
    await ws_hub.publish(f"conversation:{conversation_id}", scrub_payload(base))

    if scope == "me":
        await ws_hub.publish(f"user:{actor_id}", scrub_payload(base))
        return

    for uid in participants:
        user_payload = dict(base)
        if scope == "everyone" and doc:
            user_payload["message"] = public_message(doc, viewer_id=uid)
        await ws_hub.publish(f"user:{uid}", scrub_payload(user_payload))