"""Engine 2 Step 2.7 — test gate manifest and sign-off checks."""
from pathlib import Path

from core.e2e_integrity_proof import (
    ENGINE2_INTEGRATION_MODULES,
    ENGINE2_SCRIPTS,
    ENGINE2_UNIT_MODULES,
    run_e2e_integrity_proof,
)
from core.e2e_policy import ENGINE2_STEPS, engine2_complete
from core.retention_policy import ENGINE1_STEPS

BACKEND = Path(__file__).resolve().parents[1]


def test_engine1_prerequisite_for_engine2_gate():
    assert all(done for _, _, done in ENGINE1_STEPS), "Engine 1 must be complete before Engine 2 gate"


def test_engine2_all_steps_marked_complete():
    for step_id in ("2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"):
        step = next(s for s in ENGINE2_STEPS if s[0] == step_id)
        assert step[2] is True, f"Engine 2 step {step_id} must be complete for gate sign-off"


def test_engine2_complete_helper():
    assert engine2_complete() is True


def test_engine2_unit_modules_exist():
    missing = [m for m in ENGINE2_UNIT_MODULES if not (BACKEND / m).is_file()]
    assert missing == [], f"missing unit test modules: {missing}"


def test_engine2_integration_module_exists():
    for m in ENGINE2_INTEGRATION_MODULES:
        assert (BACKEND / m).is_file(), m


def test_engine2_gate_scripts_exist():
    missing = [s for s in ENGINE2_SCRIPTS if not (BACKEND / s).is_file()]
    assert missing == [], f"missing gate scripts: {missing}"


def test_run_engine2_gate_references_unit_and_integration():
    text = (BACKEND / "scripts" / "run_engine2_gate.py").read_text(encoding="utf-8")
    assert "ENGINE2_INTEGRATION_MODULES" in text
    assert "ENGINE2_UNIT_MODULES" in text
    assert "e2e_integrity_proof" in text


def test_e2e_integrity_proof_passes():
    report = run_e2e_integrity_proof()
    failed = [c.name for c in report.checks if not c.passed]
    assert report.passed, f"proof failures: {failed}"


def test_charter_documents_engine2_gate():
    charter = BACKEND.parent / "memory" / "E2E_INTEGRITY_CHARTER.md"
    text = charter.read_text(encoding="utf-8")
    assert "**2.7**" in text
    assert "run_engine2_gate.py" in text
    assert "e2e_integrity_proof.py" in text