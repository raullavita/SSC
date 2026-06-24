"""Build Cloud Run service YAML + secret payloads for SSC deploy."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def main() -> int:
    env_path = BACKEND / "cloud_run.env"
    if not env_path.is_file():
        print(f"Missing {env_path}", file=sys.stderr)
        return 1

    cfg = load_env(env_path)
    required = ["MONGO_URL", "DB_NAME", "JWT_SECRET", "REDIS_URL", "CONTACT_GRAPH_PEPPER"]
    missing = [k for k in required if not cfg.get(k)]
    if missing:
        print(f"cloud_run.env missing: {', '.join(missing)}", file=sys.stderr)
        return 1

    firebase_path = BACKEND / "firebase" / "service-account.json"
    if not firebase_path.is_file():
        print(f"Missing {firebase_path}", file=sys.stderr)
        return 1

    out_dir = BACKEND / ".cloudrun"
    out_dir.mkdir(exist_ok=True)

    cors = cfg.get(
        "CORS_ORIGINS",
        "https://localhost,capacitor://localhost,https://super-chat-b0992.web.app,https://super-chat-b0992.firebaseapp.com",
    )
    deploy_env = {
        "ENV": "production",
        "DB_NAME": cfg["DB_NAME"],
        "MONGO_URL": cfg["MONGO_URL"],
        "JWT_SECRET": cfg["JWT_SECRET"],
        "REDIS_URL": cfg["REDIS_URL"],
        "CONTACT_GRAPH_PEPPER": cfg["CONTACT_GRAPH_PEPPER"],
        "FIREBASE_SERVICE_ACCOUNT_JSON": firebase_path.read_text(encoding="utf-8"),
        "TRANSLATION_ENABLED": cfg.get("TRANSLATION_ENABLED", "false"),
        "LOG_LEVEL": cfg.get("LOG_LEVEL", "INFO"),
        "CORS_ORIGINS": cors,
    }
    for k in (
        "VAPID_PUBLIC",
        "VAPID_PRIVATE",
        "VAPID_EMAIL",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "FRONTEND_OAUTH_REDIRECT",
        "NATIVE_OAUTH_REDIRECT",
        "TURN_USERNAME",
        "TURN_CREDENTIAL",
    ):
        if cfg.get(k):
            deploy_env[k] = cfg[k]

    yaml_lines = [f"{k}: {json.dumps(v)}" for k, v in deploy_env.items()]
    (out_dir / "deploy_env.yaml").write_text("\n".join(yaml_lines) + "\n", encoding="utf-8")
    print(out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())