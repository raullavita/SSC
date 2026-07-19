"""Restore Cloud Run env from healthy revision + SFU/TURN harden."""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path

PROJECT = "super-chat-b0992"
REGION = "europe-west1"
HEALTHY = "ssc-api-00033-wrn"
NAT = "35.195.79.31"
SSLIP = "35-195-79-31.sslip.io"


def main() -> None:
    raw = subprocess.check_output(
        [
            "gcloud",
            "run",
            "revisions",
            "describe",
            HEALTHY,
            f"--region={REGION}",
            f"--project={PROJECT}",
            "--format=json",
        ],
        text=True,
    )
    d = json.loads(raw)
    envs = d["spec"]["containers"][0].get("env", [])
    out: dict[str, str] = {}
    for e in envs:
        if "value" in e:
            out[e["name"]] = e["value"]

    turn = None
    secrets = Path(r"C:\Users\smash\ssc\production-secrets.env")
    if secrets.exists():
        for line in secrets.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("SSC_TURN_SECRET="):
                turn = line.split("=", 1)[1].strip()

    out["SSC_SFU_ENABLED"] = "true"
    out["SSC_SFU_WS_URL"] = f"wss://{SSLIP}"
    out["SSC_SFU_INTERNAL_URL"] = f"http://{NAT}:4443"
    out["SSC_TURN_ENABLED"] = "true"
    if turn:
        out["SSC_TURN_SECRET"] = turn
    out["SSC_TURN_REALM"] = "supersecurechat.com"
    out["SSC_TURN_URIS"] = (
        f"turn:{NAT}:3478?transport=udp,turn:{NAT}:3478?transport=tcp"
    )
    out["SSC_STUN_URIS"] = f"stun:{NAT}:3478"

    # Drop garbage keys from prior bad updates if present
    for bad in list(out):
        if bad.startswith("^") or bad.startswith("turn:"):
            del out[bad]

    path = Path(tempfile.gettempdir()) / "ssc-env-restore.yaml"
    lines = []
    for k, v in sorted(out.items()):
        vv = str(v).replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'{k}: "{vv}"')
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    img = d["spec"]["containers"][0]["image"]
    print(f"keys={len(out)} image={img} file={path}")
    for k in sorted(out):
        if any(x in k for x in ("SECRET", "PASSWORD", "MONGO", "REDIS", "PEPPER", "JWT")):
            print(f"{k}=<set len={len(out[k])}>")
        else:
            print(f"{k}={out[k][:70]}")

    cmd = [
        "gcloud",
        "run",
        "services",
        "update",
        "ssc-api",
        f"--project={PROJECT}",
        f"--region={REGION}",
        f"--image={img}",
        f"--env-vars-file={path}",
    ]
    print("running:", " ".join(cmd[:8]), "...")
    r = subprocess.run(cmd, text=True)
    raise SystemExit(r.returncode)


if __name__ == "__main__":
    main()
