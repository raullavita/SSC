"""
Engine 1 test gate — Step 1.7 sign-off runner.

Runs unit tests, live-server integration checks, and MongoDB retention proof.
Usage:
  venv\\Scripts\\python.exe scripts\\run_engine1_gate.py
  venv\\Scripts\\python.exe scripts\\run_engine1_gate.py --skip-integration
  venv\\Scripts\\python.exe scripts\\run_engine1_gate.py --skip-retention-proof
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

PYTHON = ROOT / "venv" / "Scripts" / "python.exe"
if not PYTHON.is_file():
    PYTHON = Path(sys.executable)

UNIT_MODULES = [
    "tests/test_retention_policy.py",
    "tests/test_retention_ttl.py",
    "tests/test_retention_proof.py",
    "tests/test_translation_guard.py",
    "tests/test_conversation_meta.py",
    "tests/test_logging_policy.py",
    "tests/test_egress_policy.py",
    "tests/test_engine1_gate.py",
]
INTEGRATION_MODULE = "tests/test_engine1_integration.py"
BASE = __import__("os").environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE}/api"


def _run_pytest(paths: list[str], label: str) -> int:
    print(f"\n== {label} ==")
    cmd = [str(PYTHON), "-m", "pytest", *paths, "-q", "--tb=short"]
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode == 0:
        print(f"  OK  {label}")
    else:
        print(f"  FAIL {label} (exit {result.returncode})")
    return result.returncode


def _server_up() -> bool:
    try:
        r = requests.get(f"{API}/", timeout=5)
        return r.status_code == 200 and r.json().get("status") == "ok"
    except Exception:
        return False


def _run_retention_proof() -> int:
    print("\n== Retention proof (MongoDB / Charter §11) ==")
    cmd = [str(PYTHON), "scripts/retention_proof.py"]
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode == 0:
        print("  OK  retention proof")
    else:
        print(f"  FAIL retention proof (exit {result.returncode})")
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="SSC Engine 1 test gate")
    parser.add_argument("--skip-integration", action="store_true")
    parser.add_argument("--skip-retention-proof", action="store_true")
    args = parser.parse_args()

    print(f"Engine 1 gate -> {ROOT}")
    exit_code = 0

    exit_code |= _run_pytest(UNIT_MODULES, "Engine 1 unit tests")

    if not args.skip_integration:
        if not _server_up():
            print("\n== Engine 1 integration ==")
            print(f"  FAIL backend not reachable at {API}/")
            exit_code |= 1
        else:
            exit_code |= _run_pytest([INTEGRATION_MODULE], "Engine 1 integration")

    if not args.skip_retention_proof:
        exit_code |= _run_retention_proof()

    print("\n---")
    if exit_code == 0:
        print("ENGINE 1 GATE PASSED")
    else:
        print("ENGINE 1 GATE FAILED")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())