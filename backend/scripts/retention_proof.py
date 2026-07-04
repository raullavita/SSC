"""Live Mongo retention proof — verifies TTL indexes (Engine 1 step 1.7)."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.retention_policy import COLLECTIONS, ttl_collection_names
from db import get_database


def _has_ttl_index(index_info: dict, field: str) -> bool:
    for spec in index_info.values():
        keys = spec.get("key", [])
        if not keys:
            continue
        key_field = keys[0][0]
        if key_field == field and spec.get("expireAfterSeconds") == 0:
            return True
    return False


async def run_proof() -> dict:
    db = get_database()
    checks = []
    for name in ttl_collection_names():
        policy = COLLECTIONS[name]
        field = policy.ttl_field or "expires_at"
        try:
            info = await db[name].index_information()
            ok = _has_ttl_index(info, field)
            checks.append(
                {
                    "name": f"ttl_index:{name}",
                    "passed": ok,
                    "detail": (
                        f"{field} TTL index (expireAfterSeconds=0)"
                        if ok
                        else f"missing TTL index on {field}"
                    ),
                }
            )
        except Exception as exc:  # noqa: BLE001
            checks.append(
                {
                    "name": f"ttl_index:{name}",
                    "passed": False,
                    "detail": str(exc),
                }
            )

    passed = all(c["passed"] for c in checks)
    return {"passed": passed, "checks": checks}


def main() -> int:
    report = asyncio.run(run_proof())
    print(json.dumps(report, indent=2))
    if report["passed"]:
        print("RETENTION PROOF PASSED")
        return 0
    print("RETENTION PROOF FAILED")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())