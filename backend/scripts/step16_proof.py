"""Step 16 proof — encrypted client backup/export."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def main() -> int:
    checks: list[dict] = []

    policy = (BACKEND_ROOT / "core" / "backup_policy.py").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "backup_policy",
            "passed": "step16_backup_ready" in policy and "ssc-backup" in policy,
            "detail": "",
        }
    )

    backup_crypto = (REPO_ROOT / "frontend" / "src" / "lib" / "backupCrypto.js").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "backup_crypto",
            "passed": "encryptBackupPayload" in backup_crypto and "PBKDF2" in backup_crypto,
            "detail": "",
        }
    )

    backup_export = (REPO_ROOT / "frontend" / "src" / "lib" / "backupExport.js").read_text(
        encoding="utf-8"
    )
    backup_restore = (REPO_ROOT / "frontend" / "src" / "lib" / "backupRestore.js").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "backup_export_restore",
            "passed": "createEncryptedBackup" in backup_export and "restoreEncryptedBackup" in backup_restore,
            "detail": "",
        }
    )

    panel = (REPO_ROOT / "frontend" / "src" / "components" / "BackupPanel.jsx").read_text(
        encoding="utf-8"
    )
    settings = (REPO_ROOT / "frontend" / "src" / "pages" / "Settings.jsx").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "backup_settings_ui",
            "passed": "Download encrypted backup" in panel and "BackupPanel" in settings,
            "detail": "",
        }
    )

    message_index = (REPO_ROOT / "frontend" / "src" / "search" / "messageIndex.js").read_text(
        encoding="utf-8"
    )
    checks.append(
        {
            "name": "message_index_export",
            "passed": "exportAllIndexes" in message_index and "importAllIndexes" in message_index,
            "detail": "",
        }
    )

    roadmap = (REPO_ROOT / "memory" / "ROADMAP.md").read_text(encoding="utf-8")
    checks.append(
        {
            "name": "roadmap_step16",
            "passed": "Step 16" in roadmap and "Shipped" in roadmap.split("Step 16")[1].split("Step 17")[0],
            "detail": "",
        }
    )

    backend_tests = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_step16_backup.py", "-q", "--tb=line"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    checks.append(
        {
            "name": "step16_backend_tests",
            "passed": backend_tests.returncode == 0,
            "detail": "ok" if backend_tests.returncode == 0 else (backend_tests.stdout + backend_tests.stderr)[-500:],
        }
    )

    frontend_tests = subprocess.run(
        [
            "yarn",
            "test",
            "--watchAll=false",
            "src/lib/__tests__/backupCrypto.test.js",
            "src/lib/__tests__/backupExportRestore.test.js",
            "src/components/__tests__/BackupPanel.test.js",
        ],
        cwd=REPO_ROOT / "frontend",
        capture_output=True,
        text=True,
        shell=True,
    )
    checks.append(
        {
            "name": "step16_frontend_tests",
            "passed": frontend_tests.returncode == 0,
            "detail": "ok" if frontend_tests.returncode == 0 else (frontend_tests.stdout + frontend_tests.stderr)[-800:],
        }
    )

    passed = all(c["passed"] for c in checks)
    print(json.dumps({"passed": passed, "checks": checks}, indent=2))
    print("STEP 16 PROOF PASSED" if passed else "STEP 16 PROOF FAILED")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())