"""
Engine 3 test gate — Step 3.7 sign-off runner.

Runs Engine 3 unit tests, live-server integration checks, and footprint proof.
Usage:
  venv\\Scripts\\python.exe scripts/run_engine3_gate.py
  venv\\Scripts\\python.exe scripts/run_engine3_gate.py --skip-integration
  venv\\Scripts\\python.exe scripts/run_engine3_gate.py --skip-proof
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

from core.client_footprint_proof import ENGINE3_INTEGRATION_MODULES, ENGINE3_UNIT_MODULES  # noqa: E402

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


def _run_footprint_proof() -> int:
    print("\n== Client footprint proof (step 3.7) ==")
    cmd = [str(PYTHON), "scripts/client_footprint_proof.py"]
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode == 0:
        print("  OK  client footprint proof")
    else:
        print(f"  FAIL client footprint proof (exit {result.returncode})")
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="SSC Engine 3 test gate")
    parser.add_argument("--skip-integration", action="store_true")
    parser.add_argument("--skip-proof", action="store_true")
    args = parser.parse_args()

    print(f"Engine 3 gate -> {ROOT}")
    exit_code = 0

    exit_code |= _run_pytest(list(ENGINE3_UNIT_MODULES), "Engine 3 unit tests")

    if not args.skip_integration:
        if not _server_up():
            print("\n== Engine 3 integration ==")
            print(f"  FAIL backend not reachable at {API}/")
            exit_code |= 1
        else:
            exit_code |= _run_pytest(list(ENGINE3_INTEGRATION_MODULES), "Engine 3 integration")

    if not args.skip_proof:
        exit_code |= _run_footprint_proof()

    print("\n---")
    if exit_code == 0:
        print("ENGINE 3 GATE PASSED")
    else:
        print("ENGINE 3 GATE FAILED")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())