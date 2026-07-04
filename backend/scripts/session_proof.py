"""Session hardening proof — Engine 5 step 5.7."""

from __future__ import annotations

import inspect
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from core.auth_tokens import issue_access_token  # noqa: PLC0415
    from core.engine5 import engine5_complete  # noqa: PLC0415
    from core.session_cookie import set_session_cookie  # noqa: PLC0415
    from core.session_policy import SESSION_COOKIE_NAME  # noqa: PLC0415
    from core.session_ttl import session_expires_at  # noqa: PLC0415
    import routers.auth as auth_module  # noqa: PLC0415

    checks = []

    auth_source = inspect.getsource(auth_module.register)
    checks.append(
        {
            "name": "register_no_token_in_body",
            "passed": '"token"' not in auth_source.split("return")[1],
            "detail": "register response omits JWT",
        }
    )
    checks.append(
        {
            "name": "register_uses_issue_user_session",
            "passed": "issue_user_session" in auth_source,
            "detail": "register issues httpOnly cookie session",
        }
    )

    cookie_source = inspect.getsource(set_session_cookie)
    checks.append(
        {
            "name": "cookie_httponly",
            "passed": "httponly=True" in cookie_source,
            "detail": "session cookie is httpOnly",
        }
    )
    checks.append(
        {
            "name": "cookie_name",
            "passed": SESSION_COOKIE_NAME == "ssc_session",
            "detail": SESSION_COOKIE_NAME,
        }
    )

    token_source = inspect.getsource(issue_access_token)
    checks.append(
        {
            "name": "jwt_uses_session_ttl",
            "passed": "session_expires_at" in token_source,
            "detail": "JWT exp from session_ttl module",
        }
    )
    checks.append(
        {
            "name": "engine5_complete",
            "passed": engine5_complete(),
            "detail": "",
        }
    )

    api_path = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "api.js"
    api_text = api_path.read_text(encoding="utf-8") if api_path.is_file() else ""
    checks.append(
        {
            "name": "web_no_localstorage_jwt",
            "passed": "localStorage" not in api_text and "getAccessToken" not in api_text,
            "detail": "api.js does not read JWT from localStorage",
        }
    )

    footprint_path = (
        Path(__file__).resolve().parents[2]
        / "frontend"
        / "src"
        / "lib"
        / "localStorageFootprint.js"
    )
    checks.append(
        {
            "name": "local_storage_footprint_module",
            "passed": footprint_path.is_file(),
            "detail": str(footprint_path),
        }
    )

    _ = session_expires_at()

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("SESSION PROOF PASSED" if passed else "SESSION PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())