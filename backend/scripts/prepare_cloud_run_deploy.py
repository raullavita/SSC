"""Build Cloud Run service YAML + secret payloads for SSC deploy."""
from __future__ import annotations

import os
import json
import subprocess
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

    # Deploy safety gate: reject weak/unsafe production settings.
    env_errors: list[str] = []
    jwt_secret = (cfg.get("JWT_SECRET") or "").strip()
    pepper = (cfg.get("CONTACT_GRAPH_PEPPER") or "").strip()
    db_name = (cfg.get("DB_NAME") or "").strip()
    mongo_url = (cfg.get("MONGO_URL") or "").strip().lower()
    redis_url = (cfg.get("REDIS_URL") or "").strip().lower()

    if len(jwt_secret) < 48:
        env_errors.append("JWT_SECRET must be at least 48 characters")
    if len(pepper) < 48 or pepper == "ssc-dev-contact-graph-pepper":
        env_errors.append("CONTACT_GRAPH_PEPPER must be strong and must not use dev default")
    if db_name != "ssc":
        env_errors.append("DB_NAME must be 'ssc' for production deploy")
    if "localhost" in mongo_url or "127.0.0.1" in mongo_url:
        env_errors.append("MONGO_URL must not point to localhost for production deploy")
    if not redis_url.startswith("redis://") and not redis_url.startswith("rediss://"):
        env_errors.append("REDIS_URL must be a redis:// or rediss:// URL")

    if env_errors:
        print("Deploy gate failed (security env validation):", file=sys.stderr)
        for err in env_errors:
            print(f" - {err}", file=sys.stderr)
        return 1

    firebase_path = BACKEND / "firebase" / "service-account.json"
    if not firebase_path.is_file():
        print(f"Missing {firebase_path}", file=sys.stderr)
        return 1

    out_dir = BACKEND / ".cloudrun"
    out_dir.mkdir(exist_ok=True)

    # Deploy gate: retention proof must pass before deploy proceeds.
    retention_script = BACKEND / "scripts" / "retention_proof.py"
    python_bin = BACKEND / "venv" / "Scripts" / "python.exe"
    if not python_bin.is_file():
        python_bin = Path(sys.executable)
    env = os.environ.copy()
    env.update({
        "MONGO_URL": cfg["MONGO_URL"],
        "DB_NAME": cfg["DB_NAME"],
        "JWT_SECRET": cfg["JWT_SECRET"],
        "CONTACT_GRAPH_PEPPER": cfg["CONTACT_GRAPH_PEPPER"],
        "ENV": "production",
    })
    proof = subprocess.run(
        [str(python_bin), str(retention_script), "--json"],
        cwd=str(BACKEND),
        env=env,
        text=True,
        capture_output=True,
    )
    if proof.returncode != 0:
        print("Deploy gate failed: retention_proof.py returned non-zero", file=sys.stderr)
        if proof.stdout.strip():
            print(proof.stdout.strip(), file=sys.stderr)
        if proof.stderr.strip():
            print(proof.stderr.strip(), file=sys.stderr)
        return 1
    try:
        payload = json.loads(proof.stdout)
    except json.JSONDecodeError:
        print("Deploy gate failed: retention_proof.py output was not valid JSON", file=sys.stderr)
        if proof.stdout.strip():
            print(proof.stdout.strip(), file=sys.stderr)
        return 1
    if not payload.get("passed"):
        print("Deploy gate failed: retention proof reported failures", file=sys.stderr)
        for check in payload.get("checks", []):
            if not check.get("passed"):
                detail = check.get("detail") or ""
                print(f" - {check.get('name')}: {detail}", file=sys.stderr)
        return 1

    cors = cfg.get(
        "CORS_ORIGINS",
        "https://localhost,capacitor://localhost",
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
        "NATIVE_OAUTH_REDIRECT",
        "DESKTOP_OAUTH_REDIRECT",
        "TURN_USERNAME",
        "TURN_CREDENTIAL",
        "TURNSTILE_SITEKEY",
        "TURNSTILE_SECRET",
    ):
        if cfg.get(k):
            deploy_env[k] = cfg[k]

    yaml_lines = [f"{k}: {json.dumps(v)}" for k, v in deploy_env.items()]
    (out_dir / "deploy_env.yaml").write_text("\n".join(yaml_lines) + "\n", encoding="utf-8")
    print(out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())