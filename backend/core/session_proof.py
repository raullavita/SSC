"""Session hardening proof — Engine 5 Step 5.7. See memory/SESSION_HARDENING_CHARTER.md."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Tuple

from core.metadata_policy import engine4_complete
from core.session_policy import ENGINE5_STEPS, SESSION_GAPS, engine5_complete

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]

ENGINE5_UNIT_MODULES: Tuple[str, ...] = (
    "tests/test_session_policy.py",
    "tests/test_session_cookie.py",
    "tests/test_engine5_web_session.py",
    "tests/test_engine5_native_session.py",
    "tests/test_engine5_panic_logout.py",
    "tests/test_engine5_production_gate.py",
    "tests/test_engine5_gate.py",
)

ENGINE5_INTEGRATION_MODULES: Tuple[str, ...] = (
    "tests/test_engine5_integration.py",
)

ENGINE5_SCRIPTS: Tuple[str, ...] = (
    "scripts/run_engine5_gate.py",
    "scripts/session_proof.py",
)

ENFORCEMENT_PATHS: Tuple[str, ...] = (
    "memory/SESSION_HARDENING_CHARTER.md",
    "backend/core/session_policy.py",
    "backend/core/session_cookie.py",
    "backend/core/session_issue.py",
    "backend/core/session_ttl.py",
    "backend/core/session_production.py",
    "backend/core/token_revocation.py",
    "backend/routers/auth.py",
    "backend/routers/panic.py",
    "frontend/src/lib/sessionStore.js",
    "frontend/src/lib/api.js",
    "frontend/src/context/AuthContext.jsx",
    "frontend/src/lib/clientFootprintOrchestrator.js",
    "frontend/src/lib/localStorageFootprint.js",
)

DEFERRED_ENGINE5_GAPS = frozenset({"S3"})


@dataclass
class ProofCheck:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class SessionProofReport:
    checks: List[ProofCheck] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "checks": [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in self.checks],
        }


def _check_engine4_prerequisite() -> ProofCheck:
    ok = engine4_complete()
    return ProofCheck(
        name="engine4_prerequisite",
        passed=ok,
        detail="Engine 4 steps 4.1–4.7 complete" if ok else "Engine 4 must be complete before Engine 5 sign-off",
    )


def _check_engine5_steps() -> ProofCheck:
    incomplete = [step_id for step_id, _, done in ENGINE5_STEPS if not done]
    ok = not incomplete
    return ProofCheck(
        name="engine5_steps_complete",
        passed=ok,
        detail="all steps done" if ok else f"incomplete: {', '.join(incomplete)}",
    )


def _check_engine5_complete_helper() -> ProofCheck:
    ok = engine5_complete()
    return ProofCheck(
        name="engine5_complete_helper",
        passed=ok,
        detail="engine5_complete() is True" if ok else "engine5_complete() returned False",
    )


def _check_engine5_gaps() -> ProofCheck:
    open_ids = {g.gap_id for g in SESSION_GAPS if not g.resolved}
    unexpected = open_ids - DEFERRED_ENGINE5_GAPS
    ok = not unexpected
    return ProofCheck(
        name="engine5_gaps_resolved",
        passed=ok,
        detail="C8, S1, S2 resolved; S3 accepted tradeoff" if ok else f"open gaps: {sorted(unexpected)}",
    )


def _check_web_no_localstorage_jwt() -> ProofCheck:
    api_js = REPO_ROOT / "frontend" / "src" / "lib" / "api.js"
    if not api_js.is_file():
        return ProofCheck(name="web_no_localstorage_jwt", passed=False, detail="api.js missing")
    text = api_js.read_text(encoding="utf-8")
    leaks = "localStorage.getItem('ssc_token')" in text or 'localStorage.getItem("ssc_token")' in text
    ok = (
        not leaks
        and "withCredentials: false" in text
        and "getSessionToken" in text
        and "X-SSC-Client" in text
    )
    return ProofCheck(
        name="web_no_localstorage_jwt",
        passed=ok,
        detail="api.js uses installed bearer auth without localStorage JWT"
        if ok
        else "api.js still exposes JWT via localStorage or missing installed-client auth",
    )


def _check_session_cookie_on_auth() -> ProofCheck:
    auth_py = BACKEND_ROOT / "routers" / "auth.py"
    if not auth_py.is_file():
        return ProofCheck(name="session_cookie_on_auth", passed=False, detail="auth.py missing")
    text = auth_py.read_text(encoding="utf-8")
    ok = (
        "issue_authenticated_session" in text
        and "clear_session_cookie" in text
        and "resolve_request_session_token" in text
    )
    return ProofCheck(
        name="session_cookie_on_auth",
        passed=ok,
        detail="login/register set cookie; logout resolves token" if ok else "auth routes missing session helpers",
    )


def _check_session_ttl_centralized() -> ProofCheck:
    auth_py = BACKEND_ROOT / "core" / "auth.py"
    ttl_py = BACKEND_ROOT / "core" / "session_ttl.py"
    if not auth_py.is_file() or not ttl_py.is_file():
        return ProofCheck(name="session_ttl_centralized", passed=False, detail="auth.py or session_ttl.py missing")
    text = auth_py.read_text(encoding="utf-8")
    ok = "session_expires_at" in text and "jwt_exp_timestamp" in text and "timedelta(days=7)" not in text
    return ProofCheck(
        name="session_ttl_centralized",
        passed=ok,
        detail="JWT and Mongo TTL use session_ttl module" if ok else "hardcoded 7-day TTL still in auth.py",
    )


def _check_production_redis_gate() -> ProofCheck:
    security_py = BACKEND_ROOT / "security.py"
    prod_py = BACKEND_ROOT / "core" / "session_production.py"
    if not security_py.is_file() or not prod_py.is_file():
        return ProofCheck(name="production_redis_gate", passed=False, detail="security or session_production missing")
    sec = security_py.read_text(encoding="utf-8")
    ok = "validate_production_redis" in sec and prod_py.is_file()
    return ProofCheck(
        name="production_redis_gate",
        passed=ok,
        detail="startup validates Redis in production" if ok else "production Redis gate not wired",
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
    for rel in ENGINE5_UNIT_MODULES + ENGINE5_INTEGRATION_MODULES + ENGINE5_SCRIPTS:
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
    charter = REPO_ROOT / "memory" / "SESSION_HARDENING_CHARTER.md"
    if not charter.is_file():
        return ProofCheck(name="charter_gate_docs", passed=False, detail="charter missing")
    text = charter.read_text(encoding="utf-8")
    ok = "**5.7**" in text and "run_engine5_gate.py" in text
    return ProofCheck(
        name="charter_gate_docs",
        passed=ok,
        detail="charter documents step 5.7 gate" if ok else "charter missing 5.7 / run_engine5_gate.py",
    )


def run_session_proof() -> SessionProofReport:
    report = SessionProofReport()
    report.checks.append(_check_engine4_prerequisite())
    report.checks.append(_check_engine5_steps())
    report.checks.append(_check_engine5_complete_helper())
    report.checks.append(_check_engine5_gaps())
    report.checks.append(_check_web_no_localstorage_jwt())
    report.checks.append(_check_session_cookie_on_auth())
    report.checks.append(_check_session_ttl_centralized())
    report.checks.append(_check_production_redis_gate())
    report.checks.extend(_check_enforcement_files())
    report.checks.extend(_check_gate_artifacts())
    report.checks.append(_check_charter_gate_documentation())
    return report