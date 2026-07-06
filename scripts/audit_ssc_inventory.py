"""SSC custom health inventory — wiring, stubs, sizes, unfinished features.

Open-source companion to full_app_audit.ps1 (Semgrep, Bandit, Knip, etc.).
Writes audit-reports/ssc-inventory.json and prints a summary.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "audit-reports"

ROUTER_PREFIXES = {
    "abuse": "/api/abuse",
    "auth": "/api/auth",
    "calls": "/api/calls",
    "config": "/api",
    "conversations": "/api/conversations",
    "device_link": "/api/devices/link",
    "devices": "/api/devices",
    "files": "/api/files",
    "friend_requests": "/api/friend_requests",
    "groups": "/api/groups",
    "health": "/api",
    "messages": "/api",
    "panic": "/api/panic",
    "polls": "/api",
    "reactions": "/api",
    "recovery": "/api/auth/recovery",
    "prekeys": "/api/prekeys",
    "stories": "/api/stories",
    "presence": "/api/presence",
    "privacy": "/api/privacy",
    "push_router": "/api/push",
    "sfu": "/api/sfu",
    "smart": "/api/smart",
    "translation": "/api/translation",
    "typing": "/api",
    "users": "/api/users",
    "ws": "/api/ws",
    "site_feedback": "/api/public",
    "oauth_finish": "",
}

KNOWN_UNWIRED_INTENTIONAL = {
    "/api/smart/config": "Inside AI disabled by smart_policy charter",
    "/api/translation/translate": "Server translate exists; client uses opt-in local path too",
    "/api/abuse/report": "Abuse report API — no Settings UI yet",
    "/api/auth/google/start": "OAuth redirect — browser navigation, not api.get",
    "/api/auth/google/callback": "OAuth callback ÔÇö browser redirect",
    "/api/health": "Health/monitoring only",
    "/api/": "Root health alias",
    "/api/status": "Status probe",
    "/api/config": "Public config endpoint",
    "/api/ws": "WebSocket upgrade path",
    "/api/users/lookup/{target}": "UserLookup via lookupPathForQuery() template",
    "/api/users/by-username/{username}": "AddContact via lookupPathForQuery() template",
    "/api/conversations/{conversation_id}/reads": "useReadReceipts.js (multiline api.get)",
    "/auth/google": "OAuth finish HTML page — browser navigation after Google redirect",
}

POLICY_ONLY_FEATURES = [
    {
        "name": "Broadcast lists",
        "location": "backend/core/retention_policy.py",
        "detail": "Mongo collection policy only ÔÇö no router or UI",
    },
    {
        "name": "Inside AI / smart replies",
        "location": "backend/routers/smart.py",
        "detail": "Config endpoint only; NO_INSIDE_AI charter",
    },
    {
        "name": "Server-side backup",
        "location": "backend/core/backup_policy.py",
        "detail": "Client-only .ssc-backup by design",
    },
    {
        "name": "macOS native app",
        "location": "electron/electron-builder.yml (dmg target only)",
        "detail": "No macOS build script or libsignal shell",
    },
    {
        "name": "iOS libsignal native",
        "location": "ios/SuperSecureChat/SscNativeBridge.swift",
        "detail": "WKWebView shell with crypto stub",
    },
    {
        "name": "Read receipts aggregate UI",
        "location": "frontend/lib/readReceipts.js",
        "detail": "Read-by-N tooltip on outgoing messages; full reader names not shown",
    },
    {
        "name": "Web chat in browser",
        "location": "frontend InstalledClientGate.jsx",
        "detail": "Blocked by design for E2E",
    },
]

STUB_PATTERNS = [
    (r"stub", "Stub implementation"),
    (r"TODO|FIXME|HACK|XXX", "TODO marker"),
    (r"dev fallback|dev_xor|buildDevSignal", "Dev crypto fallback"),
    (r"requiresProductionCrypto", "Production crypto gate"),
    (r"NOT IMPLEMENTED|not implemented", "Not implemented marker"),
]


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def discover_backend_routes() -> list[dict]:
    routes: list[dict] = []
    routers_dir = ROOT / "backend" / "routers"
    route_re = re.compile(
        r'@router\.(get|post|put|patch|delete)\("([^"]*)"',
        re.IGNORECASE,
    )
    for path in sorted(routers_dir.glob("*.py")):
        if path.name.startswith("_"):
            continue
        stem = path.stem
        if stem == "push_router":
            stem_key = "push_router"
        else:
            stem_key = stem
        prefix = ROUTER_PREFIXES.get(stem_key, f"/api/{stem}")
        text = _read_text(path)
        conv_prefix = "/api/conversations"
        for method, sub in route_re.findall(text):
            if stem == "conversations":
                if sub == "":
                    full = conv_prefix
                elif sub.startswith("/"):
                    full = f"{conv_prefix}{sub}"
                else:
                    full = f"{conv_prefix}/{sub}"
            elif stem == "messages" and sub.startswith("/conversations"):
                full = f"/api{sub}" if not sub.startswith("/api") else sub
            elif stem in {"polls", "reactions", "typing"} and sub.startswith("/"):
                full = f"/api{sub}"
            elif stem == "config" and sub in {"/config", "/status"}:
                full = f"/api{sub}"
            elif stem == "health" and sub in {"/health", "/"}:
                full = f"/api{sub}" if sub != "/" else "/api/"
            elif sub == "":
                full = prefix.rstrip("/") or prefix
            elif sub.startswith("/"):
                full = f"{prefix}{sub}" if not sub.startswith("/api") else sub
            else:
                full = f"{prefix}/{sub}"
            full = re.sub(r"/+", "/", full)
            routes.append(
                {
                    "method": method.upper(),
                    "path": full,
                    "router": path.name,
                }
            )
    # de-dupe
    seen = set()
    unique = []
    for r in routes:
        key = (r["method"], r["path"])
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return sorted(unique, key=lambda x: (x["path"], x["method"]))


def discover_frontend_api_calls() -> list[str]:
    calls: set[str] = set()
    fe = ROOT / "frontend" / "src"
    call_re = re.compile(
        r"api\.(?:get|post|put|patch|delete)\(\s*[`'](/api/[^`'?]+)",
        re.IGNORECASE,
    )
    chained_call_re = re.compile(
        r"\.(?:get|post|put|patch|delete)\(\s*[`'](/api/[^`'?]+)",
        re.IGNORECASE,
    )
    template_re = re.compile(
        r"[`'](/api/\$\{[^}]+\}[^`'?]*)[`']"
    )
    for path in fe.rglob("*"):
        if path.suffix not in {".js", ".jsx"}:
            continue
        text = _read_text(path)
        for m in call_re.findall(text):
            calls.add(m.split("?")[0])
        for m in chained_call_re.findall(text):
            calls.add(m.split("?")[0])
        for m in template_re.findall(text):
            # normalize template paths to patterns
            norm = re.sub(r"\$\{[^}]+\}", "{id}", m)
            calls.add(norm)
    return sorted(calls)


def path_matches_call(route_path: str, call: str) -> bool:
    rp = route_path.rstrip("/")
    cp = call.rstrip("/")
    if rp == cp:
        return True
    r_parts = rp.split("/")
    c_parts = cp.split("/")
    if len(r_parts) != len(c_parts):
        return False
    for a, b in zip(r_parts, c_parts):
        if a.startswith("{") and a.endswith("}"):
            continue
        if b == "{id}":
            continue
        if a != b:
            return False
    return True


def find_unwired_backend(routes: list[dict], calls: list[str]) -> list[dict]:
    unwired = []
    for r in routes:
        path = r["path"]
        if path in KNOWN_UNWIRED_INTENTIONAL:
            continue
        if any(path_matches_call(path, c) for c in calls):
            continue
        # skip parametric if any call shares prefix
        prefix = "/".join(path.split("/")[:4])
        if any(c.startswith(prefix) for c in calls):
            continue
        unwired.append({**r, "reason": "No matching frontend api.* call found"})
    return unwired


def find_stubs() -> list[dict]:
    findings = []
    scan_roots = [
        ROOT / "frontend" / "src",
        ROOT / "backend",
        ROOT / "electron",
        ROOT / "android" / "app" / "src",
        ROOT / "ios",
    ]
    for base in scan_roots:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.suffix not in {".py", ".js", ".jsx", ".kt", ".swift", ".ts", ".tsx"}:
                continue
            if any(
                x in path.parts
                for x in ("node_modules", "venv", ".audit-venv", "__pycache__", ".gradle")
            ):
                continue
            text = _read_text(path)
            for pattern, label in STUB_PATTERNS:
                for match in re.finditer(pattern, text, re.IGNORECASE):
                    line = text.count("\n", 0, match.start()) + 1
                    findings.append(
                        {
                            "file": str(path.relative_to(ROOT)),
                            "line": line,
                            "type": label,
                            "snippet": text.splitlines()[line - 1].strip()[:120],
                        }
                    )
    return findings[:80]


def artifact_sizes() -> list[dict]:
    candidates = [
        ROOT / "electron" / "dist" / "SSC-Setup-0.3.0.exe",
        ROOT / "android" / "app" / "build" / "outputs" / "apk" / "release" / "SSC-0.3.0.apk",
        ROOT / "android" / "app" / "build" / "outputs" / "apk" / "release" / "app-release-unsigned.apk",
        ROOT / "frontend" / "build",
    ]
    out = []
    for path in candidates:
        if not path.exists():
            out.append({"path": str(path.relative_to(ROOT)), "exists": False})
            continue
        if path.is_dir():
            total = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
            out.append(
                {
                    "path": str(path.relative_to(ROOT)),
                    "exists": True,
                    "bytes": total,
                    "mb": round(total / (1024 * 1024), 2),
                    "type": "directory",
                }
            )
        else:
            size = path.stat().st_size
            out.append(
                {
                    "path": str(path.relative_to(ROOT)),
                    "exists": True,
                    "bytes": size,
                    "mb": round(size / (1024 * 1024), 2),
                    "type": "file",
                }
            )
    return out


def codebase_stats() -> dict:
    counts = {"python": 0, "javascript": 0, "kotlin": 0, "swift": 0, "tests": 0}
    for path in ROOT.rglob("*"):
        if any(x in path.parts for x in ("node_modules", "venv", ".gradle", "dist", "build", "audit-reports")):
            continue
        if path.suffix == ".py" and "test" in path.name:
            counts["tests"] += 1
        elif path.suffix == ".py":
            counts["python"] += 1
        elif path.suffix in {".js", ".jsx"} and "test" in path.name.lower():
            counts["tests"] += 1
        elif path.suffix in {".js", ".jsx"}:
            counts["javascript"] += 1
        elif path.suffix == ".kt":
            counts["kotlin"] += 1
        elif path.suffix == ".swift":
            counts["swift"] += 1
    return counts


def main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    routes = discover_backend_routes()
    calls = discover_frontend_api_calls()
    unwired = find_unwired_backend(routes, calls)
    stubs = find_stubs()
    artifacts = artifact_sizes()
    stats = codebase_stats()

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "backend_routes": len(routes),
            "frontend_api_calls": len(calls),
            "unwired_backend_routes": len(unwired),
            "stub_findings": len(stubs),
            "policy_only_features": len(POLICY_ONLY_FEATURES),
        },
        "codebase_stats": stats,
        "artifacts": artifacts,
        "policy_only_features": POLICY_ONLY_FEATURES,
        "unwired_backend_routes": unwired,
        "stub_findings": stubs,
        "intentional_unwired": KNOWN_UNWIRED_INTENTIONAL,
        "all_backend_routes": routes,
        "all_frontend_calls": calls,
    }

    out_json = REPORT_DIR / "ssc-inventory.json"
    out_json.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("SSC INVENTORY AUDIT")
    print(f"  Backend routes:     {len(routes)}")
    print(f"  Frontend API calls: {len(calls)}")
    print(f"  Unwired routes:     {len(unwired)} (see policy_only for intentional gaps)")
    print(f"  Stub/TODO hits:     {len(stubs)}")
    print(f"  Report: {out_json.relative_to(ROOT)}")
    if unwired:
        print("\nUnwired backend routes (may need UI):")
        for row in unwired[:15]:
            print(f"  - {row['method']} {row['path']} ({row['router']})")
    print("\nPolicy-only / unfinished features:")
    for feat in POLICY_ONLY_FEATURES:
        print(f"  - {feat['name']}: {feat['detail']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
