"""
MongoDB retention proof — Engine 1 Step 1.7 / Charter §11.

Verifies TTL indexes, expires_at coverage, and reports expired-row counts.
Run:
  venv\\Scripts\\python.exe scripts\\retention_proof.py
  venv\\Scripts\\python.exe scripts\\retention_proof.py --json
  venv\\Scripts\\python.exe scripts\\retention_proof.py --fail-on-expired
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from core.config import DB_NAME, MONGO_URL  # noqa: E402
from core.retention_proof import (  # noqa: E402
    CHARTER_EPHEMERAL_COLLECTIONS,
    CHARTER_PERSISTENT_COLLECTIONS,
    run_retention_proof,
)


def _mongo_client():
    import certifi
    from motor.motor_asyncio import AsyncIOMotorClient

    if MONGO_URL.startswith("mongodb+srv://") or "tls=true" in MONGO_URL:
        return AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where())
    return AsyncIOMotorClient(MONGO_URL)


async def _main(args: argparse.Namespace) -> int:
    client = _mongo_client()
    db = client[DB_NAME]
    try:
        await db.command("ping")
    except Exception as exc:
        print(f"FAIL: MongoDB ping failed: {type(exc).__name__}")
        return 1

    report = await run_retention_proof(db, fail_on_expired=args.fail_on_expired)

    if args.json:
        print(json.dumps(report.to_dict(), indent=2))
    else:
        print(f"Retention proof — database: {DB_NAME}")
        print(f"Charter ephemeral (must purge): {', '.join(CHARTER_EPHEMERAL_COLLECTIONS)}")
        print(f"Charter persistent (may remain): {', '.join(CHARTER_PERSISTENT_COLLECTIONS)}")
        print("---")
        for check in report.checks:
            status = "PASS" if check.passed else "FAIL"
            detail = f" — {check.detail}" if check.detail else ""
            print(f"{status}: {check.name}{detail}")
        if report.collection_counts:
            print("---")
            print("Collection counts:")
            for coll, count in report.collection_counts.items():
                print(f"  {coll}: {count}")
        if any(report.expired_counts.values()):
            print("---")
            print("Expired rows (await TTL monitor):")
            for coll, count in report.expired_counts.items():
                if count:
                    print(f"  {coll}: {count}")
        print("---")
        print("RETENTION PROOF PASSED" if report.passed else "RETENTION PROOF FAILED")

    return 0 if report.passed else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="SSC Engine 1 retention proof (Charter §11)")
    parser.add_argument("--json", action="store_true", help="Machine-readable output")
    parser.add_argument(
        "--fail-on-expired",
        action="store_true",
        help="Fail if any rows are past expires_at (strict CI mode)",
    )
    args = parser.parse_args()
    return asyncio.run(_main(args))


if __name__ == "__main__":
    raise SystemExit(main())