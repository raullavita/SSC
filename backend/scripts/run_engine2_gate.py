"""
Engine 2 test gate — Step 2.7 sign-off runner.

Runs Engine 2 unit tests, live-server integration checks, and integrity proof.
Usage:
  venv\\Scripts\\python.exe scripts/run_engine2_gate.py
  venv\\Scripts\\python.exe scripts/run_engine2_gate.py --skip-integration
  venv\\Scripts\\python.exe scripts/run_engine2_gate.py --skip-proof
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

from core.e2e_integrity_proof import ENGINE2_INTEGRATION_MODULES, ENGINE2_UNIT_MODULES  # noqa: E402

PYTHON = ROOT / "venv" / "Scripts" / "python.exe"
if not PYTHON.is_file():
    PYTHON = Path(sys.executable)

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


def _run_integrity_proof() -> int:
    print("\n== E2E integrity proof (Charter §11) ==")
    cmd = [str(PYTHON), "scripts/e2e_integrity_proof.py"]
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode == 0:
        print("  OK  e2e integrity proof")
    else:
        print(f"  FAIL e2e integrity proof (exit {result.returncode})")
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="SSC Engine 2 test gate")
    parser.add_argument("--skip-integration", action="store_true")
    parser.add_argument("--skip-proof", action="store_true")
    args = parser.parse_args()

    print(f"Engine 2 gate -> {ROOT}")
    exit_code = 0

    exit_code |= _run_pytest(list(ENGINE2_UNIT_MODULES), "Engine 2 unit tests")

    if not args.skip_integration:
        if not _server_up():
            print("\n== Engine 2 integration ==")
            print(f"  FAIL backend not reachable at {API}/")
            exit_code |= 1
        else:
            exit_code |= _run_pytest(list(ENGINE2_INTEGRATION_MODULES), "Engine 2 integration")

    if not args.skip_proof:
        exit_code |= _run_integrity_proof()

    print("\n---")
    if exit_code == 0:
        print("ENGINE 2 GATE PASSED")
    else:
        print("ENGINE 2 GATE FAILED")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())