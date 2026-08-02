"""Backend message soak/load harness for staged validation.

Runs against the in-process FastAPI app using an in-memory FakeDatabase so the
harness is safe to run locally and in CI without external Mongo/Redis.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import os
import statistics
import sys
import time
from collections import Counter
from pathlib import Path

# Keep limits high so the harness measures throughput/latency, not intentional 429 guards.
os.environ.setdefault("SSC_MSG_RATE_LIMIT", "100000")
os.environ.setdefault("SSC_CONV_MSG_RATE_LIMIT", "100000")
os.environ.setdefault("SSC_AUTH_RATE_LIMIT", "100000")
os.environ.setdefault("SSC_PREKEY_FETCH_LIMIT", "100000")
os.environ.setdefault("SSC_NEW_ACCOUNT_GRACE_HOURS", "0")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from httpx import ASGITransport, AsyncClient

from server import create_app
from tests.fake_mongo import FakeDatabase
from tests.helpers import seed_accepted_friendship

CLIENT_HEADERS = {
    "X-SSC-Client": "android/0.4.0/15",
    "X-SSC-Native-Bridge": "v1",
    "X-SSC-Device-Attest": "ssc-attest-test-v1",
}
VALID_CT = base64.b64encode(b"x" * 32).decode("ascii")


async def _no_redis():
    return None


def _patch_runtime_db(fake_db: FakeDatabase) -> None:
    """Patch modules that imported get_database/get_redis by name."""
    import db
    import deps
    import push
    import routers.auth
    import routers.conversations
    import routers.friend_requests
    import routers.messages
    from core import token_revocation

    db.get_database = lambda: fake_db
    db.get_redis = _no_redis

    deps.get_database = lambda: fake_db
    push.get_database = lambda: fake_db
    routers.auth.get_database = lambda: fake_db
    routers.messages.get_database = lambda: fake_db
    routers.conversations.get_database = lambda: fake_db
    routers.friend_requests.get_database = lambda: fake_db
    token_revocation.get_database = lambda: fake_db
    token_revocation.get_redis = _no_redis


def _percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]
    values_sorted = sorted(values)
    k = (len(values_sorted) - 1) * q
    lo = int(k)
    hi = min(lo + 1, len(values_sorted) - 1)
    if lo == hi:
        return values_sorted[lo]
    frac = k - lo
    return values_sorted[lo] * (1.0 - frac) + values_sorted[hi] * frac


async def _register_user(ac: AsyncClient, idx: int) -> tuple[str, dict]:
    email = f"soak{idx}@example.com"
    display_name = f"Soak{idx}"
    resp = await ac.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "display_name": display_name},
        headers=CLIENT_HEADERS,
    )
    body = resp.json()
    if resp.status_code != 200:
        raise RuntimeError(f"register_failed idx={idx} status={resp.status_code} detail={body}")
    return body["user"]["id"], dict(resp.cookies)


async def _send_once(
    ac: AsyncClient,
    conversation_id: str,
    cookies: dict,
    idx: int,
    sem: asyncio.Semaphore,
) -> tuple[int, float, str | None]:
    payload = {
        "ciphertext": VALID_CT,
        "protocol": "signal_v1",
        "reply_to": None,
    }
    async with sem:
        t0 = time.perf_counter()
        resp = await ac.post(
            f"/api/conversations/{conversation_id}/messages",
            json=payload,
            headers=CLIENT_HEADERS,
            cookies=cookies,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
    detail = None
    if resp.status_code >= 400:
        try:
            detail = str(resp.json().get("detail"))
        except Exception:
            detail = resp.text[:200]
    _ = idx
    return resp.status_code, elapsed_ms, detail


async def run_soak(args: argparse.Namespace) -> int:
    fake_db = FakeDatabase()
    _patch_runtime_db(fake_db)

    app = create_app()
    app.state.enforce_installed_client = False
    transport = ASGITransport(app=app)

    status_counts: Counter[int] = Counter()
    error_details: Counter[str] = Counter()
    latencies_ms: list[float] = []

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        users: list[tuple[str, dict]] = []
        for i in range(args.users):
            users.append(await _register_user(ac, i))

        anchor_user, anchor_cookies = users[0]
        peer_pairs = users[1:]
        for peer_id, _peer_cookies in peer_pairs:
            await seed_accepted_friendship(fake_db, anchor_user, peer_id)

        conversations: list[tuple[str, dict, dict]] = []
        for peer_id, peer_cookies in peer_pairs:
            conv = await ac.post(
                "/api/conversations",
                json={"participant_id": peer_id},
                headers=CLIENT_HEADERS,
                cookies=anchor_cookies,
            )
            conv_body = conv.json()
            if conv.status_code != 200:
                raise RuntimeError(
                    f"conversation_failed peer={peer_id} status={conv.status_code} detail={conv_body}"
                )
            conversation_id = conv_body["conversation"]["id"]
            conversations.append((conversation_id, anchor_cookies, peer_cookies))

        sem = asyncio.Semaphore(args.concurrency)
        tasks: list[asyncio.Task] = []
        total = 0
        for conversation_id, c1, c2 in conversations:
            for n in range(args.messages_per_conversation):
                # Alternate sender across both participants in the DM.
                sender_cookies = c1 if (n % 2 == 0) else c2
                tasks.append(
                    asyncio.create_task(_send_once(ac, conversation_id, sender_cookies, n, sem))
                )
                total += 1

        for done in await asyncio.gather(*tasks):
            status, elapsed_ms, detail = done
            status_counts[status] += 1
            latencies_ms.append(elapsed_ms)
            if detail:
                error_details[detail] += 1

        # Read path spot-check from anchor account.
        read_ok = 0
        for conversation_id, _c1, _c2 in conversations:
            listed = await ac.get(
                f"/api/conversations/{conversation_id}/messages",
                headers=CLIENT_HEADERS,
                cookies=anchor_cookies,
            )
            if listed.status_code == 200:
                read_ok += 1

    success = status_counts.get(200, 0)
    failures = total - success
    error_rate = (failures / total) if total else 1.0
    p50 = _percentile(latencies_ms, 0.50)
    p95 = _percentile(latencies_ms, 0.95)
    p99 = _percentile(latencies_ms, 0.99)

    passed = (
        error_rate <= args.max_error_rate
        and p95 <= args.max_p95_ms
        and read_ok == len(conversations)
    )

    summary = {
        "passed": passed,
        "users": args.users,
        "conversations": len(conversations),
        "total_messages": total,
        "success_200": success,
        "failures": failures,
        "error_rate": round(error_rate, 6),
        "latency_ms": {
            "min": round(min(latencies_ms), 3) if latencies_ms else 0,
            "p50": round(p50, 3),
            "p95": round(p95, 3),
            "p99": round(p99, 3),
            "max": round(max(latencies_ms), 3) if latencies_ms else 0,
            "mean": round(statistics.fmean(latencies_ms), 3) if latencies_ms else 0,
        },
        "status_counts": dict(sorted(status_counts.items())),
        "top_error_details": dict(error_details.most_common(5)),
        "read_spotcheck_ok": read_ok,
        "read_spotcheck_total": len(conversations),
        "thresholds": {
            "max_error_rate": args.max_error_rate,
            "max_p95_ms": args.max_p95_ms,
        },
    }

    import json

    print(json.dumps(summary, indent=2))
    print("SOAK PASSED" if passed else "SOAK FAILED")
    return 0 if passed else 1


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run in-process backend message soak/load test")
    parser.add_argument("--users", type=int, default=8, help="Total registered users (>=2)")
    parser.add_argument(
        "--messages-per-conversation",
        type=int,
        default=120,
        help="Messages sent per direct conversation",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=24,
        help="Concurrent in-flight send requests",
    )
    parser.add_argument(
        "--max-error-rate",
        type=float,
        default=0.01,
        help="Fail if error_rate exceeds this value",
    )
    parser.add_argument(
        "--max-p95-ms",
        type=float,
        default=250.0,
        help="Fail if p95 message send latency exceeds this threshold",
    )
    return parser


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()
    if args.users < 2:
        parser.error("--users must be >= 2")
    if args.messages_per_conversation < 1:
        parser.error("--messages-per-conversation must be >= 1")
    if args.concurrency < 1:
        parser.error("--concurrency must be >= 1")
    return asyncio.run(run_soak(args))


if __name__ == "__main__":
    raise SystemExit(main())
