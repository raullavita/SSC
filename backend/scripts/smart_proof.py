"""Engine 12 feature proof."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from core.engine12 import engine12_complete  # noqa: PLC0415

    repo = Path(__file__).resolve().parents[2]
    checks = []

    for rel in [
        "backend/core/feature_policy.py",
        "backend/core/engine12.py",
        "backend/routers/typing.py",
        "frontend/src/search/messageIndex.js",
        "frontend/src/lib/languageDetect.js",
        "frontend/src/chat/useTypingIndicator.js",
        "frontend/src/chat/useVoiceMessage.js",
    ]:
        path = repo / rel
        checks.append({"name": f"file:{rel}", "passed": path.is_file(), "detail": ""})

    checks.append(
        {
            "name": "legacy_llm_removed",
            "passed": not (repo / "frontend" / "src" / "smart" / "smartReply.js").is_file(),
            "detail": "no smartReply.js",
        }
    )

    index = (repo / "frontend" / "src" / "search" / "messageIndex.js").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "minisearch_local_index",
            "passed": "MiniSearch" in index,
            "detail": "encrypted local search",
        }
    )

    chat = (repo / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "chat_home_search",
            "passed": "searchMessages" in chat and "useSmartReplies" not in chat,
            "detail": "search without legacy LLM",
        }
    )

    checks.append({"name": "engine12_complete", "passed": engine12_complete(), "detail": ""})

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("FEATURE PROOF PASSED" if passed else "FEATURE PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())