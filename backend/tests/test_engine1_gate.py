"""Engine 1 Step 1.7 — test gate manifest and sign-off checks."""
from pathlib import Path

from core.retention_policy import ENGINE1_STEPS

BACKEND = Path(__file__).resolve().parents[1]

ENGINE1_UNIT_MODULES = (
    "tests/test_retention_policy.py",
    "tests/test_retention_ttl.py",
    "tests/test_retention_proof.py",
    "tests/test_translation_guard.py",
    "tests/test_conversation_meta.py",
    "tests/test_logging_policy.py",
    "tests/test_egress_policy.py",
    "tests/test_engine1_gate.py",
)

ENGINE1_INTEGRATION_MODULES = ("tests/test_engine1_integration.py",)

ENGINE1_SCRIPTS = (
    "scripts/run_engine1_gate.py",
    "scripts/retention_proof.py",
)


def test_engine1_all_steps_marked_complete():
    for step_id in ("1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"):
        step = next(s for s in ENGINE1_STEPS if s[0] == step_id)
        assert step[2] is True, f"Engine 1 step {step_id} must be complete for gate sign-off"


def test_engine1_unit_modules_exist():
    missing = [m for m in ENGINE1_UNIT_MODULES if not (BACKEND / m).is_file()]
    assert missing == [], f"missing unit test modules: {missing}"


def test_engine1_integration_module_exists():
    for m in ENGINE1_INTEGRATION_MODULES:
        assert (BACKEND / m).is_file(), m


def test_engine1_gate_scripts_exist():
    missing = [s for s in ENGINE1_SCRIPTS if not (BACKEND / s).is_file()]
    assert missing == [], f"missing gate scripts: {missing}"


def test_run_engine1_gate_references_unit_and_integration():
    text = (BACKEND / "scripts" / "run_engine1_gate.py").read_text(encoding="utf-8")
    assert "test_engine1_integration" in text
    assert "test_retention_policy" in text
    assert "retention_proof" in text


def test_engine2_charter_exists_when_engine1_complete():
    from core.e2e_policy import engine1_complete
    charter = BACKEND.parent / "memory" / "E2E_INTEGRITY_CHARTER.md"
    if engine1_complete():
        assert charter.is_file(), "Engine 2.1 charter should exist after Engine 1 sign-off"


def test_charter_documents_engine1_gate():
    charter = BACKEND.parent / "memory" / "RETENTION_CHARTER.md"
    text = charter.read_text(encoding="utf-8")
    assert "**1.7**" in text
    assert "run_engine1_gate.py" in text
    assert "retention_proof.py" in text