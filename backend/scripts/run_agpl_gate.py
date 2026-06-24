#!/usr/bin/env python3
"""AGPL compliance gate — Play Store / conveyance policy."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    print("== AGPL compliance unit tests ==")
    r = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_agpl_policy.py", "-q"],
        cwd=ROOT,
    )
    if r.returncode != 0:
        print("\nAGPL GATE FAILED")
        return 1
    print("\nAGPL GATE PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())