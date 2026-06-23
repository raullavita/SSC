"""Engine 3 Step 3.5 — IndexedDB audit and purge enforcement."""
from pathlib import Path

from core.indexeddb_audit import (
    AUDIT_FINDINGS,
    ENFORCEMENT_MODULE,
    SSC_OWNED_DATABASES,
    find_unauthorized_indexeddb_references,
)


def test_no_unauthorized_indexeddb_usage_in_frontend_src():
    violations = find_unauthorized_indexeddb_references()
    assert violations == [], f"Unexpected IndexedDB references: {violations}"


def test_audit_manifest_documents_enforcement():
    assert ENFORCEMENT_MODULE.endswith("indexedDBFootprint.js")
    assert len(SSC_OWNED_DATABASES) == 0
    enforcement = [f for f in AUDIT_FINDINGS if f.severity == "enforcement"]
    assert len(enforcement) >= 1


def test_indexeddb_footprint_module_exists():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "indexedDBFootprint.js").read_text(encoding="utf-8")
    assert "purgeIndexedDBFootprint" in text
    assert "indexedDB.databases" in text
    assert "deleteDatabase" in text
    assert "SSC_OWNED_INDEXEDDB_NAMES" in text


def test_memory_wipe_invokes_indexeddb_purge():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "memoryWipe.js").read_text(encoding="utf-8")
    assert "purgeIndexedDBFootprint" in text
    assert "from './indexedDBFootprint'" in text