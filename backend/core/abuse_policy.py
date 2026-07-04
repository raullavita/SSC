"""Anti-abuse policy — rate limits, spam heuristics — Engine 8."""

from __future__ import annotations

import os
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

# Per-user message rate (sliding window).
MSG_RATE_LIMIT = int(os.getenv("SSC_MSG_RATE_LIMIT", "60"))
MSG_RATE_WINDOW_SEC = int(os.getenv("SSC_MSG_RATE_WINDOW_SEC", "60"))

# Per-IP auth attempt limit.
AUTH_RATE_LIMIT = int(os.getenv("SSC_AUTH_RATE_LIMIT", "20"))
AUTH_RATE_WINDOW_SEC = int(os.getenv("SSC_AUTH_RATE_WINDOW_SEC", "300"))

# File upload limits.
MAX_FILE_BYTES = int(os.getenv("SSC_MAX_FILE_BYTES", str(25 * 1024 * 1024)))
MAX_FILES_PER_HOUR = int(os.getenv("SSC_MAX_FILES_PER_HOUR", "30"))

# Executable magic bytes blocked at relay layer (malware bot mitigation).
BLOCKED_FILE_MAGIC: tuple[bytes, ...] = (
    b"MZ",  # Windows PE
    b"\x7fELF",  # Linux ELF
    b"\xca\xfe\xba\xbe",  # Mach-O fat
    b"PK\x03\x04",  # ZIP (often used to smuggle executables)
)


@dataclass
class SlidingWindow:
    limit: int
    window_sec: int
    buckets: dict[str, list[float]] = field(default_factory=lambda: defaultdict(list))

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        hits = self.buckets[key]
        cutoff = now - self.window_sec
        self.buckets[key] = [t for t in hits if t >= cutoff]
        if len(self.buckets[key]) >= self.limit:
            return False
        self.buckets[key].append(now)
        return True

    def remaining(self, key: str) -> int:
        now = time.monotonic()
        cutoff = now - self.window_sec
        hits = [t for t in self.buckets.get(key, []) if t >= cutoff]
        return max(0, self.limit - len(hits))


msg_rate_limiter = SlidingWindow(MSG_RATE_LIMIT, MSG_RATE_WINDOW_SEC)
auth_rate_limiter = SlidingWindow(AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_SEC)
file_rate_limiter = SlidingWindow(MAX_FILES_PER_HOUR, 3600)


def file_magic_blocked(data: bytes) -> bool:
    if not data:
        return False
    for magic in BLOCKED_FILE_MAGIC:
        if data.startswith(magic):
            return True
    return False


def spam_score_heuristic(text_sample: str) -> int:
    """Lightweight OSS heuristic — higher = more suspicious."""
    if not text_sample:
        return 0
    score = 0
    lower = text_sample.lower()
    if "http://" in lower or "https://" in lower:
        score += 2
    if lower.count("@") > 3:
        score += 2
    if sum(1 for c in text_sample if c.isupper()) > len(text_sample) * 0.6:
        score += 1
    return score


def engine8_abuse_policy_ready() -> bool:
    return MSG_RATE_LIMIT > 0 and MAX_FILE_BYTES > 0