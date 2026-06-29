"""Security scan proof — Q.56 OWASP ZAP CI + security smoke."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List

from core.security_scan_policy import (
    SECURITY_SMOKE_SCRIPT,
    ZAP_RULES_PATH,
    ZAP_WORKFLOW_PATH,
    security_scan_enabled,
)

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass
class ProofCheck:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class SecurityScanProofReport:
    checks: List[ProofCheck] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "checks": [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in self.checks],
        }


def _check_q56_policy() -> ProofCheck:
    policy = REPO_ROOT / "backend/core/security_scan_policy.py"
    ok = policy.is_file() and security_scan_enabled()
    return ProofCheck(
        name="q56_policy",
        passed=ok,
        detail="Q.56 security_scan_policy present" if ok else "security_scan_policy missing",
    )


def _check_q56_zap_workflow() -> ProofCheck:
    workflow = REPO_ROOT / ZAP_WORKFLOW_PATH
    if not workflow.is_file():
        return ProofCheck(name="q56_zap_workflow", passed=False, detail="zap.yml missing")
    text = workflow.read_text(encoding="utf-8")
    ok = "zaproxy/action-baseline" in text and "security_smoke" in text
    return ProofCheck(
        name="q56_zap_workflow",
        passed=ok,
        detail="Q.56 OWASP ZAP baseline workflow wired" if ok else "zap workflow incomplete",
    )


def _check_q56_zap_rules() -> ProofCheck:
    rules = REPO_ROOT / ZAP_RULES_PATH
    ok = rules.is_file() and rules.stat().st_size > 0
    return ProofCheck(
        name="q56_zap_rules",
        passed=ok,
        detail="Q.56 ZAP rules.tsv present" if ok else "ZAP rules missing",
    )


def _check_q56_smoke_script() -> ProofCheck:
    script = REPO_ROOT / SECURITY_SMOKE_SCRIPT
    middleware = REPO_ROOT / "backend/middleware.py"
    ok = script.is_file()
    if ok:
        text = script.read_text(encoding="utf-8")
        mw = middleware.read_text(encoding="utf-8")
        ok = (
            "check_protected_routes" in text
            and "X-Content-Type-Options" in mw
            and "security_smoke" in (REPO_ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
        )
    return ProofCheck(
        name="q56_security_smoke",
        passed=ok,
        detail="Q.56 security smoke script + CI step" if ok else "security smoke wiring incomplete",
    )


def _check_q56_tests() -> ProofCheck:
    tests = [
        REPO_ROOT / "backend/tests/test_security_scan_policy.py",
        REPO_ROOT / "backend/tests/test_security_smoke.py",
    ]
    ok = all(p.is_file() for p in tests)
    return ProofCheck(
        name="q56_tests",
        passed=ok,
        detail="Q.56 security scan tests present" if ok else "security scan tests missing",
    )


def run_security_scan_proof() -> SecurityScanProofReport:
    checks = [
        _check_q56_policy(),
        _check_q56_zap_workflow(),
        _check_q56_zap_rules(),
        _check_q56_smoke_script(),
        _check_q56_tests(),
    ]
    return SecurityScanProofReport(checks=checks)