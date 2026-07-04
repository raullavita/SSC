"""Retention policy and charter sync tests — Engine 1."""

from __future__ import annotations

from pathlib import Path

import pytest

from core.lifespan import LIFESPAN_COLLECTIONS
from core.retention_policy import (
    COLLECTIONS,
    all_collection_names,
    default_expires_at,
    engine1_complete,
    ttl_collection_names,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
CHARTER_PATH = REPO_ROOT / "memory" / "RETENTION_CHARTER.md"


def test_engine1_complete():
    assert engine1_complete() is True


def test_every_lifespan_collection_has_policy():
    policy_names = set(COLLECTIONS.keys())
    missing = LIFESPAN_COLLECTIONS - policy_names
    extra = policy_names - LIFESPAN_COLLECTIONS
    assert not missing, f"Collections in lifespan.py missing from retention policy: {missing}"
    assert not extra, f"Policy lists unknown collections: {extra}"


def test_charter_markdown_exists_and_references_all_collections():
    assert CHARTER_PATH.is_file(), "memory/RETENTION_CHARTER.md must exist"
    text = CHARTER_PATH.read_text(encoding="utf-8")
    for name in all_collection_names():
        assert f"`{name}`" in text, f"Charter must mention collection `{name}`"


def test_ttl_collections_use_expires_at():
    for name in ttl_collection_names():
        policy = COLLECTIONS[name]
        assert policy.ttl_field == "expires_at", f"{name} must TTL on expires_at"


def test_default_expires_at_is_future():
    exp = default_expires_at()
    from datetime import datetime, timezone

    assert exp > datetime.now(timezone.utc)


def test_all_policies_have_purpose():
    for name, policy in COLLECTIONS.items():
        assert policy.purpose.strip(), f"{name} missing purpose"
        assert policy.panic_field, f"{name} missing panic_field for wipe path"


@pytest.mark.parametrize("name", all_collection_names())
def test_collection_registered(name: str):
    assert name in COLLECTIONS