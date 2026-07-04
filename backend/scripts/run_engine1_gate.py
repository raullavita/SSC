"""Engine 1 gate — retention charter, policy sync, panic wipe, TTL indexes."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def _check_file(rel: str) -> dict:
    path = REPO_ROOT / rel.replace("/", "\\") if "\\" not in rel else REPO_ROOT / rel
    if not path.is_file():
        path = BACKEND_ROOT / rel.split("backend/")[-1] if rel.startswith("backend/") else path
    exists = path.is_file()
    return {"name": f"file:{rel}", "passed": exists, "detail": "" if exists else "missing"}


def _run_pytest_multiple(targets: list[str]) -> tuple[bool, str]:
    result = subprocess.run(
        [sys.executable, "-m", "pytest", *targets, "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    ok = result.returncode == 0
    detail = "ok" if ok else (result.stdout + result.stderr)[-500:]
    return ok, detail


def main() -> int:
    sys.path.insert(0, str(BACKEND_ROOT))
    from core.retention_policy import engine1_complete  # noqa: PLC0415

    checks: list[dict] = []

    checks.append(
        {
            "name": "engine1_complete_helper",
            "passed": engine1_complete(),
            "detail": "engine1_complete() is True" if engine1_complete() else "incomplete",
        }
    )

    for rel in [
        "memory/RETENTION_CHARTER.md",
        "backend/core/retention_policy.py",
        "backend/core/lifespan.py",
        "backend/core/panic_wipe.py",
        "backend/routers/panic.py",
        "backend/scripts/retention_proof.py",
        "backend/tests/test_retention_policy.py",
        "backend/tests/test_panic_wipe_service.py",
    ]:
        checks.append(_check_file(rel))

    unit_ok, unit_detail = _run_pytest_multiple(
        ["tests/test_retention_policy.py", "tests/test_panic_wipe_service.py"]
    )
    checks.append({"name": "engine1_unit_tests", "passed": unit_ok, "detail": unit_detail})

    charter_path = REPO_ROOT / "memory" / "RETENTION_CHARTER.md"
    charter_text = charter_path.read_text(encoding="utf-8") if charter_path.is_file() else ""
    charter_ok = "step 1.7 gate" in charter_text.lower() or "1.7" in charter_text
    checks.append(
        {
            "name": "charter_gate_docs",
            "passed": charter_ok,
            "detail": "charter documents step 1.7 gate" if charter_ok else "missing gate doc reference",
        }
    )

    passed = all(c["passed"] for c in checks)
    report = {"passed": passed, "checks": checks}
    print(json.dumps(report, indent=2))
    print("ENGINE 1 GATE PASSED" if passed else "ENGINE 1 GATE FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())