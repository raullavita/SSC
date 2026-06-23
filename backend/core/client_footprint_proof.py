"""Client footprint integrity proof — Engine 3 Step 3.7. See memory/CLIENT_FOOTPRINT_CHARTER.md step 3.7."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Tuple

from core.client_footprint_policy import ENGINE3_STEPS, FOOTPRINT_GAPS, engine3_complete
from core.e2e_policy import engine2_complete
from core.panic_wipe_service import PANIC_PRESERVE_COLLECTIONS, PANIC_WIPE_COLLECTIONS

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]

ENGINE3_UNIT_MODULES: Tuple[str, ...] = (
    "tests/test_client_footprint_policy.py",
    "tests/test_memory_wipe.py",
    "tests/test_indexeddb_audit.py",
    "tests/test_client_footprint_orchestrator.py",
    "tests/test_panic_wipe_service.py",
    "tests/test_engine3_gate.py",
)

ENGINE3_INTEGRATION_MODULES: Tuple[str, ...] = (
    "tests/test_engine3_integration.py",
)

ENGINE3_SCRIPTS: Tuple[str, ...] = (
    "scripts/run_engine3_gate.py",
    "scripts/client_footprint_proof.py",
)

ENFORCEMENT_PATHS: Tuple[str, ...] = (
    "memory/CLIENT_FOOTPRINT_CHARTER.md",
    "backend/core/client_footprint_policy.py",
    "backend/core/panic_wipe_service.py",
    "backend/core/indexeddb_audit.py",
    "backend/routers/panic.py",
    "frontend/src/lib/memoryWipe.js",
    "frontend/src/lib/serviceWorkerCache.js",
    "frontend/public/sw.js",
    "frontend/src/lib/localStorageFootprint.js",
    "frontend/src/lib/indexedDBFootprint.js",
    "frontend/src/lib/clientFootprintOrchestrator.js",
    "frontend/src/lib/sessionStorageFootprint.js",
    "frontend/src/context/AuthContext.jsx",
)

DEFERRED_ENGINE3_GAPS = frozenset({"C8"})


@dataclass
class ProofCheck:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class ClientFootprintProofReport:
    checks: List[ProofCheck] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "checks": [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in self.checks],
        }


def _check_engine2_prerequisite() -> ProofCheck:
    ok = engine2_complete()
    return ProofCheck(
        name="engine2_prerequisite",
        passed=ok,
        detail="Engine 2 steps 2.1–2.7 complete" if ok else "Engine 2 must be complete before Engine 3 sign-off",
    )


def _check_engine3_steps() -> ProofCheck:
    incomplete = [step_id for step_id, _, done in ENGINE3_STEPS if not done]
    ok = not incomplete
    return ProofCheck(
        name="engine3_steps_complete",
        passed=ok,
        detail="all steps done" if ok else f"incomplete: {', '.join(incomplete)}",
    )


def _check_engine3_complete_helper() -> ProofCheck:
    ok = engine3_complete()
    return ProofCheck(
        name="engine3_complete_helper",
        passed=ok,
        detail="engine3_complete() is True" if ok else "engine3_complete() returned False",
    )


def _check_engine3_gaps() -> ProofCheck:
    open_ids = {g.gap_id for g in FOOTPRINT_GAPS if not g.resolved}
    unexpected = open_ids - DEFERRED_ENGINE3_GAPS
    ok = not unexpected
    return ProofCheck(
        name="engine3_gaps_resolved",
        passed=ok,
        detail="C1–C7 resolved; C8 deferred to Engine 5" if ok else f"open gaps: {sorted(unexpected)}",
    )


def _check_panic_wipe_scope() -> ProofCheck:
    ok = (
        "users" in PANIC_PRESERVE_COLLECTIONS
        and "contacts" in PANIC_PRESERVE_COLLECTIONS
        and "conversations" in PANIC_WIPE_COLLECTIONS
        and "messages" in PANIC_WIPE_COLLECTIONS
        and "files" in PANIC_WIPE_COLLECTIONS
    )
    return ProofCheck(
        name="panic_wipe_scope",
        passed=ok,
        detail="account + contacts preserved; chats/files wiped",
    )


def _check_enforcement_files() -> List[ProofCheck]:
    checks: List[ProofCheck] = []
    for rel in ENFORCEMENT_PATHS:
        path = REPO_ROOT / rel
        checks.append(
            ProofCheck(
                name=f"file:{rel}",
                passed=path.is_file(),
                detail="" if path.is_file() else "missing",
            )
        )
    return checks


def _check_gate_artifacts() -> List[ProofCheck]:
    checks: List[ProofCheck] = []
    for rel in ENGINE3_UNIT_MODULES + ENGINE3_INTEGRATION_MODULES + ENGINE3_SCRIPTS:
        path = BACKEND_ROOT / rel
        checks.append(
            ProofCheck(
                name=f"artifact:{rel}",
                passed=path.is_file(),
                detail="" if path.is_file() else "missing",
            )
        )
    return checks


def _check_charter_gate_documentation() -> ProofCheck:
    charter = REPO_ROOT / "memory" / "CLIENT_FOOTPRINT_CHARTER.md"
    if not charter.is_file():
        return ProofCheck(name="charter_gate_docs", passed=False, detail="charter missing")
    text = charter.read_text(encoding="utf-8")
    ok = "**3.7**" in text and "run_engine3_gate.py" in text
    return ProofCheck(
        name="charter_gate_docs",
        passed=ok,
        detail="charter documents step 3.7 gate" if ok else "charter missing 3.7 / run_engine3_gate.py",
    )


def run_client_footprint_proof() -> ClientFootprintProofReport:
    report = ClientFootprintProofReport()
    report.checks.append(_check_engine2_prerequisite())
    report.checks.append(_check_engine3_steps())
    report.checks.append(_check_engine3_complete_helper())
    report.checks.append(_check_engine3_gaps())
    report.checks.append(_check_panic_wipe_scope())
    report.checks.extend(_check_enforcement_files())
    report.checks.extend(_check_gate_artifacts())
    report.checks.append(_check_charter_gate_documentation())
    return report