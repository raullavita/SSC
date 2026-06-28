"""API response integrity — Engine 2 Step 2.4. See memory/E2E_INTEGRITY_CHARTER.md §6."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, FrozenSet, Optional

from core.migration_policy import normalize_message_protocol
from core.utils import iso

# Never persist or return on messages/statuses (length side-channel + redundant handles).
FORBIDDEN_RESPONSE_FIELDS: FrozenSet[str] = frozenset({
    "plaintext_length",
    "sender_username",
})

MESSAGE_STORAGE_OMIT: FrozenSet[str] = frozenset({
    "plaintext_length",
    "sender_username",
})


def project_message_for_viewer(msg: dict, viewer_id: str) -> dict:
    """One message with only the viewer's wrapped keys; strip metadata leaks."""
    if not msg:
        return msg
    if msg.get("message_type") == "deleted" or msg.get("deleted_for_everyone_at"):
        return {
            k: msg[k]
            for k in (
                "message_id",
                "conversation_id",
                "sender_id",
                "message_type",
                "created_at",
                "expires_at",
                "deleted_for_everyone_at",
                "deleted_by",
                "reply_to_message_id",
            )
            if k in msg
        }
    out = dict(msg)
    protocol = normalize_message_protocol(out.get("protocol"))
    out["protocol"] = protocol
    if protocol in ("signal_v1", "signal_group_v1"):
        out.pop("encrypted_keys", None)
        out.pop("iv", None)
    else:
        keys = out.get("encrypted_keys") or {}
        own = keys.get(viewer_id)
        out["encrypted_keys"] = {viewer_id: own} if own else {}

    attach_keys = out.get("attachment_encrypted_keys")
    if attach_keys:
        own_attach = attach_keys.get(viewer_id)
        out["attachment_encrypted_keys"] = {viewer_id: own_attach} if own_attach else {}

    for field in FORBIDDEN_RESPONSE_FIELDS:
        out.pop(field, None)

    if isinstance(out.get("expires_at"), datetime):
        out["expires_at"] = iso(out["expires_at"])
    if isinstance(out.get("created_at"), datetime):
        out["created_at"] = iso(out["created_at"])
    return out


def project_status_for_viewer(status: dict, viewer_id: str) -> dict:
    """Status row with viewer-projected keys and forbidden fields removed."""
    if not status:
        return status
    out = dict(status)
    protocol = normalize_message_protocol(out.get("protocol"))
    out["protocol"] = protocol
    if protocol == "signal_status_v1":
        out.pop("encrypted_keys", None)
        out.pop("iv", None)
    else:
        keys = out.get("encrypted_keys") or {}
        own = keys.get(viewer_id)
        out["encrypted_keys"] = {viewer_id: own} if own else {}
    out.pop("plaintext_length", None)
    if out.get("author_id") != viewer_id:
        out.pop("viewers", None)
    if isinstance(out.get("expires_at"), datetime):
        out["expires_at"] = iso(out["expires_at"])
    if isinstance(out.get("created_at"), datetime):
        out["created_at"] = iso(out["created_at"])
    return out


def sanitize_message_for_storage(fields: Dict[str, Any]) -> Dict[str, Any]:
    """Drop fields that must not be written to Mongo on new messages."""
    return {k: v for k, v in fields.items() if k not in MESSAGE_STORAGE_OMIT}


def sanitize_status_for_storage(fields: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in fields.items() if k != "plaintext_length"}