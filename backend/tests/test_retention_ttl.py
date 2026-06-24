"""Engine 1 Step 1.3 — TTL on conversation metadata and social tokens."""
import os
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from core.retention import (
    TTL_INDEX_COLLECTIONS,
    conversation_activity_fields,
    expires_at_from_now,
    friend_request_pending_expires_at,
    friend_request_resolved_expires_at,
    message_read_expiry_fields,
    retention_hours,
)
from core.retention_policy import COLLECTIONS, EnforcementStatus, collections_with_gaps


def test_retention_hours_default():
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("SSC_RETENTION_HOURS", None)
        assert retention_hours() == 24


def test_retention_hours_env_override():
    with patch.dict(os.environ, {"SSC_RETENTION_HOURS": "12"}, clear=False):
        assert retention_hours() == 12


def test_retention_hours_clamped():
    with patch.dict(os.environ, {"SSC_RETENTION_HOURS": "9999"}, clear=False):
        assert retention_hours() == 24 * 30


def test_expires_at_from_now_uses_retention_window():
    with patch.dict(os.environ, {"SSC_RETENTION_HOURS": "6"}, clear=False):
        before = datetime.now(timezone.utc)
        exp = expires_at_from_now()
        delta_h = (exp - before).total_seconds() / 3600
        assert 5.9 < delta_h < 6.1


def test_conversation_activity_fields_include_expires_at():
    fields = conversation_activity_fields()
    assert "last_activity_at" in fields
    assert "expires_at" in fields
    assert isinstance(fields["expires_at"], datetime)


def test_message_read_expiry_fields():
    fields = message_read_expiry_fields()
    assert "expires_at" in fields
    assert isinstance(fields["expires_at"], datetime)


def test_friend_request_pending_longer_than_resolved():
    pending = friend_request_pending_expires_at()
    resolved = friend_request_resolved_expires_at()
    assert pending > resolved


def test_engine13_collections_enforced_in_policy():
    for name in ("conversations", "message_reads", "friend_requests"):
        policy = COLLECTIONS[name]
        assert policy.ttl_field == "expires_at", name
        assert policy.enforcement == EnforcementStatus.ENFORCED, name


def test_no_retention_gaps_after_engine_13():
    assert collections_with_gaps() == []


def test_ttl_index_collections_include_engine_13():
    for name in ("conversations", "message_reads", "friend_requests"):
        assert name in TTL_INDEX_COLLECTIONS


def test_lifespan_declares_ttl_indexes():
    from pathlib import Path
    text = (Path(__file__).resolve().parents[1] / "lifespan.py").read_text(encoding="utf-8")
    for coll in ("conversations", "message_reads", "friend_requests"):
        assert f"db.{coll}.create_index(\"expires_at\"" in text, f"missing TTL index for {coll}"