"""E2E integrity proof helpers — Engine 2 Step 2.7. See memory/E2E_INTEGRITY_CHARTER.md §11."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from core.e2e_policy import ENGINE2_STEPS, INTEGRITY_GAPS, engine1_complete, engine2_complete
from core.retention_policy import ENGINE1_STEPS

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]

ENGINE2_UNIT_MODULES: Tuple[str, ...] = (
    "tests/test_e2e_policy.py",
    "tests/test_api_integrity.py",
    "tests/test_file_integrity.py",
    "tests/test_verification_policy.py",
    "tests/test_engine2_gate.py",
)

ENGINE2_INTEGRATION_MODULES: Tuple[str, ...] = (
    "tests/test_engine2_integration.py",
)

ENGINE2_SCRIPTS: Tuple[str, ...] = (
    "scripts/run_engine2_gate.py",
    "scripts/e2e_integrity_proof.py",
)

ENFORCEMENT_PATHS: Tuple[str, ...] = (
    "memory/E2E_INTEGRITY_CHARTER.md",
    "backend/core/e2e_policy.py",
    "backend/core/api_integrity.py",
    "backend/core/file_integrity.py",
    "backend/core/verification_policy.py",
    "backend/routers/files.py",
    "frontend/src/lib/vault.js",
    "frontend/src/lib/files.js",
    "frontend/src/lib/verification.js",
    "frontend/src/components/VerifyHandshakeModal.jsx",
    "frontend/src/context/AuthContext.jsx",
)

DEFERRED_ENGINE2_GAPS = frozenset({"G6", "G9"})


@dataclass
class ProofCheck:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class E2EIntegrityProofReport:
    checks: List[ProofCheck] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "checks": [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in self.checks],
        }


def _check_engine1_prerequisite() -> ProofCheck:
    ok = engine1_complete()
    return ProofCheck(
        name="engine1_prerequisite",
        passed=ok,
        detail="Engine 1 steps 1.1–1.7 complete" if ok else "Engine 1 must be complete before Engine 2 sign-off",
    )


def _check_engine2_steps() -> ProofCheck:
    incomplete = [step_id for step_id, _, done in ENGINE2_STEPS if not done]
    ok = not incomplete
    return ProofCheck(
        name="engine2_steps_complete",
        passed=ok,
        detail="all steps done" if ok else f"incomplete: {', '.join(incomplete)}",
    )


def _check_engine2_gaps() -> ProofCheck:
    open_ids = {g.gap_id for g in INTEGRITY_GAPS if not g.resolved}
    unexpected = open_ids - DEFERRED_ENGINE2_GAPS
    ok = not unexpected
    return ProofCheck(
        name="engine2_gaps_resolved",
        passed=ok,
        detail="G1–G5, G7–G8 resolved; G6/G9 deferred to Engine 8" if ok else f"open gaps: {sorted(unexpected)}",
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
    for rel in ENGINE2_UNIT_MODULES + ENGINE2_INTEGRATION_MODULES + ENGINE2_SCRIPTS:
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
    charter = REPO_ROOT / "memory" / "E2E_INTEGRITY_CHARTER.md"
    if not charter.is_file():
        return ProofCheck(name="charter_gate_docs", passed=False, detail="charter missing")
    text = charter.read_text(encoding="utf-8")
    ok = "**2.7**" in text and "run_engine2_gate.py" in text
    return ProofCheck(
        name="charter_gate_docs",
        passed=ok,
        detail="charter documents step 2.7 gate" if ok else "charter missing 2.7 / run_engine2_gate.py",
    )


def run_e2e_integrity_proof() -> E2EIntegrityProofReport:
    report = E2EIntegrityProofReport()
    report.checks.append(_check_engine1_prerequisite())
    report.checks.append(_check_engine2_steps())
    report.checks.append(_check_engine2_gaps())
    report.checks.extend(_check_enforcement_files())
    report.checks.extend(_check_gate_artifacts())
    report.checks.append(_check_charter_gate_documentation())
    return report