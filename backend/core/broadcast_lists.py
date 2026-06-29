"""Broadcast lists — Q.30 (saved contact subsets for one-to-many sends)."""
from __future__ import annotations

import re
import uuid
from typing import Dict, List, Optional

from fastapi import HTTPException

from core.contact_helpers import are_contacts

MAX_BROADCAST_LISTS = 20
MAX_BROADCAST_RECIPIENTS = 50
MAX_BROADCAST_LIST_NAME = 64


def normalize_broadcast_list_name(value: Optional[str]) -> str:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    if not text:
        raise HTTPException(400, "List name is required")
    if len(text) > MAX_BROADCAST_LIST_NAME:
        raise HTTPException(400, f"List name must be at most {MAX_BROADCAST_LIST_NAME} characters")
    return text


def normalize_recipient_ids(value: Optional[List[str]]) -> List[str]:
    if not value:
        raise HTTPException(400, "At least one recipient is required")
    ids = sorted({str(v).strip() for v in value if str(v).strip()})
    if not ids:
        raise HTTPException(400, "At least one recipient is required")
    if len(ids) > MAX_BROADCAST_RECIPIENTS:
        raise HTTPException(400, f"Broadcast lists can have at most {MAX_BROADCAST_RECIPIENTS} recipients")
    return ids


async def validate_broadcast_recipients(owner_id: str, recipient_ids: List[str]) -> List[str]:
    if owner_id in recipient_ids:
        raise HTTPException(400, "Cannot include yourself in a broadcast list")
    for rid in recipient_ids:
        if not await are_contacts(owner_id, rid):
            raise HTTPException(403, "All recipients must be mutual contacts")
    return recipient_ids


def broadcast_lists_public_config() -> Dict[str, int]:
    return {
        "max_lists": MAX_BROADCAST_LISTS,
        "max_recipients": MAX_BROADCAST_RECIPIENTS,
    }


def new_broadcast_list_id() -> str:
    return f"bl_{uuid.uuid4().hex[:12]}"


def project_broadcast_list_for_api(doc: dict) -> dict:
    return {
        "list_id": doc["list_id"],
        "name": doc["name"],
        "recipient_ids": list(doc.get("recipient_ids") or []),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }