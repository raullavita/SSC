"""Engine 3 Step 3.7 — test gate manifest and sign-off checks."""
from pathlib import Path

from core.client_footprint_proof import (
    ENGINE3_INTEGRATION_MODULES,
    ENGINE3_SCRIPTS,
    ENGINE3_UNIT_MODULES,
    run_client_footprint_proof,
)
from core.client_footprint_policy import ENGINE3_STEPS, engine3_complete
from core.e2e_policy import ENGINE2_STEPS

BACKEND = Path(__file__).resolve().parents[1]


def test_engine2_prerequisite_for_engine3_gate():
    assert all(done for _, _, done in ENGINE2_STEPS), "Engine 2 must be complete before Engine 3 gate"


def test_engine3_all_steps_marked_complete():
    for step_id in ("3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7"):
        step = next(s for s in ENGINE3_STEPS if s[0] == step_id)
        assert step[2] is True, f"Engine 3 step {step_id} must be complete for gate sign-off"


def test_engine3_complete_helper():
    assert engine3_complete() is True


def test_engine3_unit_modules_exist():
    missing = [m for m in ENGINE3_UNIT_MODULES if not (BACKEND / m).is_file()]
    assert missing == [], f"missing unit test modules: {missing}"


def test_engine3_integration_module_exists():
    for m in ENGINE3_INTEGRATION_MODULES:
        assert (BACKEND / m).is_file(), m


def test_engine3_gate_scripts_exist():
    missing = [s for s in ENGINE3_SCRIPTS if not (BACKEND / s).is_file()]
    assert missing == [], f"missing gate scripts: {missing}"


def test_run_engine3_gate_references_unit_and_integration():
    text = (BACKEND / "scripts" / "run_engine3_gate.py").read_text(encoding="utf-8")
    assert "ENGINE3_INTEGRATION_MODULES" in text
    assert "ENGINE3_UNIT_MODULES" in text
    assert "client_footprint_proof" in text


def test_client_footprint_proof_passes():
    report = run_client_footprint_proof()
    failed = [c.name for c in report.checks if not c.passed]
    assert report.passed, f"proof failures: {failed}"


def test_charter_documents_engine3_gate():
    charter = BACKEND.parent / "memory" / "CLIENT_FOOTPRINT_CHARTER.md"
    text = charter.read_text(encoding="utf-8")
    assert "**3.7**" in text
    assert "run_engine3_gate.py" in text
    assert "client_footprint_proof.py" in text