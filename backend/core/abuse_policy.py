"""Anti-abuse policy — rate limits, spam heuristics — Engine 8."""

from __future__ import annotations

import os

from core.rate_limit import RateLimiter

# Per-user message rate (sliding window).
MSG_RATE_LIMIT = int(os.getenv("SSC_MSG_RATE_LIMIT", "60"))
MSG_RATE_WINDOW_SEC = int(os.getenv("SSC_MSG_RATE_WINDOW_SEC", "60"))

# Per-IP auth attempt limit.
AUTH_RATE_LIMIT = int(os.getenv("SSC_AUTH_RATE_LIMIT", "20"))
AUTH_RATE_WINDOW_SEC = int(os.getenv("SSC_AUTH_RATE_WINDOW_SEC", "300"))

# Public website feedback (per hashed IP).
FEEDBACK_RATE_LIMIT = int(os.getenv("SSC_FEEDBACK_RATE_LIMIT", "6"))
FEEDBACK_RATE_WINDOW_SEC = int(os.getenv("SSC_FEEDBACK_RATE_WINDOW_SEC", "600"))

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

msg_rate_limiter = RateLimiter("msg", MSG_RATE_LIMIT, MSG_RATE_WINDOW_SEC)
auth_rate_limiter = RateLimiter("auth", AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_SEC)
feedback_rate_limiter = RateLimiter("feedback", FEEDBACK_RATE_LIMIT, FEEDBACK_RATE_WINDOW_SEC)
file_rate_limiter = RateLimiter("file", MAX_FILES_PER_HOUR, 3600)


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