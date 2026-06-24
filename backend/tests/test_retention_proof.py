"""Engine 1 Step 1.7 — retention proof module."""
from core.retention import TTL_INDEX_COLLECTIONS
from core.retention_proof import (
    CHARTER_EPHEMERAL_COLLECTIONS,
    CHARTER_PERSISTENT_COLLECTIONS,
    ProofCheck,
    RetentionProofReport,
    _has_ttl_index,
)


def test_has_ttl_index_detects_expires_at():
    indexes = {
        "expires_at_1": {"key": [("expires_at", 1)], "expireAfterSeconds": 0},
        "created_at_1": {"key": [("created_at", 1)]},
    }
    assert _has_ttl_index(indexes) is True


def test_has_ttl_index_rejects_missing():
    indexes = {"created_at_1": {"key": [("created_at", 1)]}}
    assert _has_ttl_index(indexes) is False


def test_charter_collections_cover_ttl_ephemeral():
    for coll in ("conversations", "message_reads", "messages", "files", "statuses"):
        assert coll in TTL_INDEX_COLLECTIONS
        assert coll in CHARTER_EPHEMERAL_COLLECTIONS


def test_charter_persistent_includes_account_and_sessions():
    for coll in ("users", "contacts", "user_sessions"):
        assert coll in CHARTER_PERSISTENT_COLLECTIONS


def test_retention_proof_report_passed_property():
    report = RetentionProofReport(
        checks=[ProofCheck("a", True), ProofCheck("b", True)],
    )
    assert report.passed is True
    report.checks.append(ProofCheck("c", False))
    assert report.passed is False


def test_retention_proof_report_to_dict():
    report = RetentionProofReport(checks=[ProofCheck("ttl_index:messages", True, "ok")])
    data = report.to_dict()
    assert data["passed"] is True
    assert data["checks"][0]["name"] == "ttl_index:messages"