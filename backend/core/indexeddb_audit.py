"""
IndexedDB footprint audit — Engine 3 Step 3.5.

Mirror of memory/CLIENT_FOOTPRINT_CHARTER.md §5.5.
No SSC application code opens IndexedDB today; wipe deletes any DB found at runtime.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

AUDIT_DATE = "2026-06-23"
ENFORCEMENT_MODULE = "frontend/src/lib/indexedDBFootprint.js"

# SSC-owned database names (empty until app code intentionally uses IndexedDB).
SSC_OWNED_DATABASES: Tuple[str, ...] = ()

# Transitive deps may create these; not used by SSC sw.js today — still purged on wipe.
THIRD_PARTY_DATABASE_CANDIDATES: Tuple[str, ...] = (
    "workbox-expiration",
    "workbox-background-sync",
)

ALLOWED_INDEXEDDB_REFERENCES: Tuple[str, ...] = (
    "indexedDBFootprint.js",
    "vault.js",
)


@dataclass(frozen=True)
class IndexedDBAuditFinding:
    finding_id: str
    description: str
    severity: str


AUDIT_FINDINGS: Tuple[IndexedDBAuditFinding, ...] = (
    IndexedDBAuditFinding(
        "IDB-1",
        "No indexedDB.open / IDBDatabase usage in frontend/src application code",
        "info",
    ),
    IndexedDBAuditFinding(
        "IDB-2",
        "QueryClient has no persist adapter — no TanStack IndexedDB cache",
        "info",
    ),
    IndexedDBAuditFinding(
        "IDB-3",
        "Custom sw.js does not use Workbox — no workbox-* DBs expected at runtime",
        "info",
    ),
    IndexedDBAuditFinding(
        "IDB-4",
        "purgeIndexedDBFootprint() deletes all databases via indexedDB.databases()",
        "enforcement",
    ),
)


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def frontend_src_files() -> List[Path]:
    src = repo_root() / "frontend" / "src"
    return [p for p in src.rglob("*") if p.is_file() and p.suffix in {".js", ".jsx", ".ts", ".tsx"}]


def find_unauthorized_indexeddb_references() -> List[str]:
    """Return relative paths that call the IndexedDB API outside the allowlist."""
    violations: List[str] = []
    api_patterns = ("indexedDB.", "IDBDatabase", "IDBTransaction", "IDBObjectStore")
    for path in frontend_src_files():
        rel = path.relative_to(repo_root()).as_posix()
        if any(allowed in rel for allowed in ALLOWED_INDEXEDDB_REFERENCES):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if any(p in text for p in api_patterns):
            violations.append(rel)
    return sorted(violations)