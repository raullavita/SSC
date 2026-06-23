"""
E2E integrity proof — Engine 2 Step 2.7 / Charter §11.

Verifies policy completion, gap resolution, and enforcement artifacts.
Run:
  venv\\Scripts\\python.exe scripts/e2e_integrity_proof.py
  venv\\Scripts\\python.exe scripts/e2e_integrity_proof.py --json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from core.e2e_integrity_proof import run_e2e_integrity_proof  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="SSC Engine 2 E2E integrity proof")
    parser.add_argument("--json", action="store_true", help="Emit JSON report")
    args = parser.parse_args()

    report = run_e2e_integrity_proof()

    if args.json:
        print(json.dumps(report.to_dict(), indent=2))
    else:
        print("E2E integrity proof — Engine 2 Step 2.7")
        print("---")
        for check in report.checks:
            status = "PASS" if check.passed else "FAIL"
            detail = f" — {check.detail}" if check.detail else ""
            print(f"{status}: {check.name}{detail}")
        print("---")
        print("E2E INTEGRITY PROOF PASSED" if report.passed else "E2E INTEGRITY PROOF FAILED")

    return 0 if report.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())