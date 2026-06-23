"""Retention proof helpers — Engine 1 Step 1.7. See memory/RETENTION_CHARTER.md §11."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from core.retention import TTL_INDEX_COLLECTIONS

# Charter §11: must be empty after recycle window (TTL purge).
CHARTER_EPHEMERAL_COLLECTIONS = (
    "messages",
    "files",
    "statuses",
    "conversations",
    "message_reads",
    "invites",
)

# Charter §11: may persist (account + social graph + active sessions/devices).
CHARTER_PERSISTENT_COLLECTIONS = (
    "users",
    "contacts",
    "user_sessions",
    "push_subscriptions",
    "native_push_tokens",
)


@dataclass
class ProofCheck:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class RetentionProofReport:
    checks: List[ProofCheck] = field(default_factory=list)
    expired_counts: Dict[str, int] = field(default_factory=dict)
    collection_counts: Dict[str, int] = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "checks": [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in self.checks],
            "expired_counts": self.expired_counts,
            "collection_counts": self.collection_counts,
        }


def _has_ttl_index(indexes: dict) -> bool:
    for spec in indexes.values():
        if spec.get("expireAfterSeconds") != 0:
            continue
        keys = spec.get("key") or []
        if keys and keys[0][0] == "expires_at":
            return True
    return False


async def check_ttl_indexes(db) -> List[ProofCheck]:
    checks: List[ProofCheck] = []
    for coll in TTL_INDEX_COLLECTIONS:
        indexes = await db[coll].index_information()
        ok = _has_ttl_index(indexes)
        checks.append(
            ProofCheck(
                name=f"ttl_index:{coll}",
                passed=ok,
                detail="expires_at TTL index (expireAfterSeconds=0)" if ok else "missing TTL index on expires_at",
            )
        )
    return checks


async def check_expires_at_coverage(db) -> List[ProofCheck]:
    """Every row in TTL-managed collections must carry expires_at (backfill guarantee)."""
    checks: List[ProofCheck] = []
    for coll in TTL_INDEX_COLLECTIONS:
        missing = await db[coll].count_documents({"expires_at": {"$exists": False}})
        ok = missing == 0
        checks.append(
            ProofCheck(
                name=f"expires_at_field:{coll}",
                passed=ok,
                detail=f"missing on {missing} row(s)" if not ok else "all rows have expires_at",
            )
        )
    return checks


async def count_collection_documents(db) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for coll in sorted(set(CHARTER_EPHEMERAL_COLLECTIONS) | set(CHARTER_PERSISTENT_COLLECTIONS)):
        counts[coll] = await db[coll].count_documents({})
    return counts


async def count_expired_documents(db, at: Optional[datetime] = None) -> Dict[str, int]:
    """Rows past expires_at — Mongo TTL monitor should purge these (runs ~60s)."""
    now = at or datetime.now(timezone.utc)
    counts: Dict[str, int] = {}
    for coll in TTL_INDEX_COLLECTIONS:
        counts[coll] = await db[coll].count_documents({"expires_at": {"$lt": now}})
    return counts


async def run_retention_proof(db, *, fail_on_expired: bool = False) -> RetentionProofReport:
    report = RetentionProofReport()
    report.checks.extend(await check_ttl_indexes(db))
    report.checks.extend(await check_expires_at_coverage(db))
    report.collection_counts = await count_collection_documents(db)
    report.expired_counts = await count_expired_documents(db)

    expired_total = sum(report.expired_counts.values())
    report.checks.append(
        ProofCheck(
            name="expired_documents",
            passed=expired_total == 0 or not fail_on_expired,
            detail=(
                "no expired rows pending TTL purge"
                if expired_total == 0
                else f"{expired_total} expired row(s) await Mongo TTL monitor"
            ),
        )
    )
    return report