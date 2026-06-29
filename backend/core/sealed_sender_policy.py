"""Sealed sender — Q.52 (hide sender_id from server storage for 1:1 Signal messages)."""
from __future__ import annotations

SEALED_SENDER_VERSION = 1
SEALED_DELIVERY_TOKEN_TTL_SEC = 120
COLLECTION_DELIVERY_TOKENS = "sealed_delivery_tokens"
MAX_SEALED_PAYLOAD_B64 = 600_000