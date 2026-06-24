#!/usr/bin/env python3
"""Unified identity gate."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    print("== Unified identity policy tests ==")
    r = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_unified_identity_policy.py", "-q"],
        cwd=ROOT,
    )
    if r.returncode != 0:
        print("\nUNIFIED IDENTITY GATE FAILED")
        return 1
    print("\nUNIFIED IDENTITY GATE PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())