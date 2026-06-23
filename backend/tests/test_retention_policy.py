"""Engine 1 Step 1.1 — retention charter is complete and matches codebase."""
import re
from pathlib import Path

import pytest

from core.egress_policy import EGRESS_IDS
from core.retention_policy import (
    COLLECTIONS,
    ENGINE1_STEPS,
    GRIDFS_POLICY,
    THIRD_PARTY_EGRESS,
    CollectionPolicy,
    EnforcementStatus,
    all_collection_names,
    collections_with_gaps,
)

# Collections that lifespan.py creates indexes for (source of truth for Mongo usage)
LIFESPAN_COLLECTIONS = {
    "users",
    "messages",
    "files",
    "calls",
    "user_sessions",
    "conversations",
    "push_subscriptions",
    "native_push_tokens",
    "message_reads",
    "statuses",
    "friend_requests",
    "contacts",
    "invites",
}


def test_every_lifespan_collection_has_policy():
    policy_names = set(COLLECTIONS.keys())
    missing = LIFESPAN_COLLECTIONS - policy_names
    extra = policy_names - LIFESPAN_COLLECTIONS
    assert not missing, f"Collections in lifespan.py missing from retention policy: {missing}"
    assert not extra, f"Policy lists unknown collections: {extra}"


def test_charter_markdown_exists_and_references_all_collections():
    charter_path = Path(__file__).resolve().parents[2] / "memory" / "RETENTION_CHARTER.md"
    assert charter_path.is_file(), "memory/RETENTION_CHARTER.md must exist"
    text = charter_path.read_text(encoding="utf-8")
    for name in all_collection_names():
        assert f"`{name}`" in text, f"Charter must mention collection `{name}`"


def test_engine1_steps_11_through_17_marked_complete():
    for step_id in ("1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"):
        step = next(s for s in ENGINE1_STEPS if s[0] == step_id)
        assert step[2] is True, f"Engine 1 step {step_id} should be marked complete"


def test_ephemeral_collections_have_ttl_field_or_gap_documented():
    ephemeral = [
        p for p in COLLECTIONS.values()
        if p.enforcement in (EnforcementStatus.ENFORCED, EnforcementStatus.GAP)
        and p.tier.value in ("ephemeral", "conversation_meta")
    ]
    for p in ephemeral:
        if p.enforcement == EnforcementStatus.ENFORCED:
            assert p.ttl_field == "expires_at", f"{p.name} should use expires_at TTL"
        if p.enforcement == EnforcementStatus.GAP:
            assert p.engine1_step, f"{p.name} gap must name an engine1 step"


def test_known_gaps_empty_after_engine_13():
    gap_names = {p.name for p in collections_with_gaps()}
    assert gap_names == set(), f"Unexpected retention policy gaps: {gap_names}"


def test_gridfs_documented():
    assert GRIDFS_POLICY.tier.value == "ephemeral"
    assert GRIDFS_POLICY.enforcement == EnforcementStatus.ENFORCED


def test_third_party_egress_has_stable_ids():
    assert len(THIRD_PARTY_EGRESS) == len(EGRESS_IDS)
    assert {e["id"] for e in THIRD_PARTY_EGRESS} == set(EGRESS_IDS)


def test_policy_module_docstring_points_to_charter():
    import core.retention_policy as mod
    assert "RETENTION_CHARTER" in (mod.__doc__ or "")


@pytest.mark.parametrize("name,policy", list(COLLECTIONS.items()))
def test_policy_entries_are_well_formed(name: str, policy: CollectionPolicy):
    assert policy.name == name
    assert policy.max_lifetime
    assert policy.allowed_fields