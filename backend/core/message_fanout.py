"""Message fanout — conversation + multi-device user topics — Engine 9."""

from __future__ import annotations

from typing import Any

from core.block_policy import should_deliver_to_participant
from core.device_ciphertext_policy import filter_message_doc_for_devices, participant_device_ids
from core.metadata_policy import public_message, scrub_payload
from core.ws_hub import ws_hub


async def _viewer_message(doc: dict[str, Any], viewer_id: str) -> dict[str, Any]:
    from db import get_database

    db = get_database()
    device_ids = await participant_device_ids(db, viewer_id)
    filtered = filter_message_doc_for_devices(doc, device_ids)
    return public_message(filtered, viewer_id=viewer_id)


def _conversation_message(doc: dict[str, Any]) -> dict[str, Any]:
    """Conversation topic: metadata only — never fan out per-device ciphertext maps."""
    redacted = {k: v for k, v in doc.items() if k != "device_ciphertexts"}
    return public_message(redacted, viewer_id=None)


async def fanout_message(
    conversation_id: str,
    doc: dict[str, Any],
    participants: list[str],
    sender_id: str,
) -> None:
    message = _conversation_message(doc)
    await ws_hub.publish(
        f"conversation:{conversation_id}",
        scrub_payload(
            {
                "type": "message",
                "message": message,
            }
        ),
    )

    from db import get_database

    db = get_database()
    for uid in participants:
        if not await should_deliver_to_participant(db, sender_id, uid):
            continue
        viewer_message = await _viewer_message(doc, uid)
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


async def fanout_reaction_event(
    conversation_id: str,
    reaction: dict,
    participants: list[str],
    *,
    event_type: str,
    sender_id: str | None = None,
) -> None:
    payload = scrub_payload(
        {
            "type": event_type,
            "reaction": reaction,
            "conversation_id": conversation_id,
        }
    )
    await ws_hub.publish(f"conversation:{conversation_id}", payload)
    from db import get_database

    db = get_database()
    for uid in participants:
        if sender_id and not await should_deliver_to_participant(db, sender_id, uid):
            continue
        await ws_hub.publish(f"user:{uid}", payload)


async def fanout_message_edited(
    conversation_id: str,
    doc: dict[str, Any],
    participants: list[str],
    sender_id: str | None = None,
) -> None:
    message = _conversation_message(doc)
    payload = scrub_payload({"type": "message_edited", "message": message})
    await ws_hub.publish(f"conversation:{conversation_id}", payload)
    from db import get_database

    db = get_database()
    actor = sender_id or doc.get("sender_id")
    for uid in participants:
        if actor and not await should_deliver_to_participant(db, actor, uid):
            continue
        viewer_message = await _viewer_message(doc, uid)
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
        base["message"] = _conversation_message(doc)

    if scope == "me":
        await ws_hub.publish(f"user:{actor_id}", scrub_payload(base))
        return

    await ws_hub.publish(f"conversation:{conversation_id}", scrub_payload(base))

    for uid in participants:
        user_payload = dict(base)
        if scope == "everyone" and doc:
            user_payload["message"] = await _viewer_message(doc, uid)
        await ws_hub.publish(f"user:{uid}", scrub_payload(user_payload))