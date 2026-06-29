"""Q.64 — TASK J full device matrix policy (release-candidate QA gate)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Mapping, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]
DEVICE_MATRIX_DIR = REPO_ROOT / "device-matrix"
MATRIX_DOC_PATH = DEVICE_MATRIX_DIR / "MATRIX.md"
RELEASE_CANDIDATE_PATH = DEVICE_MATRIX_DIR / "RELEASE_CANDIDATE.json"
REPORT_TEMPLATE_PATH = REPO_ROOT / "test_reports" / "Q64_DEVICE_MATRIX.md"
FOUNDER_SETUP_PATH = REPO_ROOT / "scripts" / "DEVICE_MATRIX_SETUP.txt"
RUN_SCRIPT_PS1 = REPO_ROOT / "scripts" / "run_device_matrix.ps1"
SMOKE_SCRIPT = REPO_ROOT / "backend" / "scripts" / "device_matrix_smoke.py"
PRIOR_QA_REPORT = REPO_ROOT / "test_reports" / "TASK_J_QA_2026-06-27.md"
TURN_MATRIX_REPORT = REPO_ROOT / "test_reports" / "Q31_TURN_OFF_LAN_MATRIX.md"

MATRIX_ID = "Q.64"
MINIMUM_WAVE_ID = "Q.15"
DEFAULT_RELEASE_CANDIDATE_VERSION = "1.0.12"
DEFAULT_API_URL = "https://api.supersecurechat.com"

DEVICE_MATRIX_ENV = "SSC_DEVICE_MATRIX_COMPLETE"
DEVICE_MATRIX_REPORT_ENV = "SSC_DEVICE_MATRIX_REPORT_PATH"

PRIMARY_DEVICES: Tuple[str, ...] = ("tester-win", "tester-android")
STRETCH_DEVICES: Tuple[str, ...] = ("tester-mac", "tester-ios")
ALLOWED_PLATFORMS: Tuple[str, ...] = ("windows", "android", "mac", "ios")

DEVICE_MATRIX_REQUIREMENTS: Tuple[str, ...] = (
    "release_candidate_after_q15",
    "primary_devices_windows_android",
    "production_api_smoke",
    "installed_client_header_on_product_api",
    "full_task_j_matrix_logged",
    "turn_off_lan_submatrix_when_calls_tested",
    "founder_sign_off_in_test_reports",
)

# TASK J matrix rows — founder marks pass/fail in test_reports/Q64_DEVICE_MATRIX.md
MATRIX_ROWS: Tuple[Mapping[str, str], ...] = (
    {"id": "auth_google_both", "area": "Auth", "test": "Google login both devices", "depends_on": ""},
    {"id": "auth_persist_force_close", "area": "Auth", "test": "Stay logged in after force-close", "depends_on": "TASK B"},
    {"id": "auth_google_only_email_error", "area": "Auth", "test": "Google-only email login shows friendly error", "depends_on": "TASK H.5"},
    {"id": "contacts_friend_request", "area": "Contacts", "test": "Friend request live (send + accept)", "depends_on": "TASK C"},
    {"id": "chat_dm_realtime", "area": "Chat", "test": "1:1 text real-time", "depends_on": ""},
    {"id": "chat_no_legacy_ui", "area": "Chat", "test": "No vault / legacy / upgrade UI", "depends_on": "TASK A"},
    {"id": "chat_media_roundtrip", "area": "Chat", "test": "Image + voice note + file", "depends_on": "TASK E"},
    {"id": "chat_block_mute", "area": "Chat", "test": "Block + mute", "depends_on": "TASK F"},
    {"id": "groups_create_message", "area": "Groups", "test": "Create + name + message", "depends_on": "TASK F"},
    {"id": "calls_voice_video_ring", "area": "Calls", "test": "Voice + video duplex + ring", "depends_on": "TASK D"},
    {"id": "stories_post_expiry", "area": "Stories", "test": "Post + 24h expiry", "depends_on": ""},
    {"id": "security_panic_wipe", "area": "Security", "test": "Panic wipe (data gone, account remains)", "depends_on": ""},
    {"id": "security_2fa", "area": "Security", "test": "2FA enable + login", "depends_on": ""},
    {"id": "push_background", "area": "Push", "test": "Message + friend request when backgrounded", "depends_on": "TASK C"},
    {"id": "translate_on_device", "area": "Translate", "test": "On-device Android (different languages)", "depends_on": ""},
    {"id": "retention_24h", "area": "Retention", "test": "Messages gone after 24h", "depends_on": "TASK I.4"},
    {"id": "nav_android_back", "area": "Nav", "test": "Android system back correct", "depends_on": "TASK G"},
    {"id": "multi_simultaneous", "area": "Multi", "test": "Same account phone + desktop simultaneous", "depends_on": ""},
    {"id": "offline_queue_reconnect", "area": "Offline", "test": "Queue + reconnect", "depends_on": ""},
)

PREFLIGHT_CHECKS: Tuple[str, ...] = (
    "api_health",
    "public_config",
    "installed_client_policy",
    "client_updates_version",
    "matrix_artifacts_present",
)


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def _env_flag(name: str) -> bool:
    return _env(name).lower() in ("1", "true", "yes", "on")


def load_release_candidate() -> Dict[str, Any]:
    if not RELEASE_CANDIDATE_PATH.is_file():
        return {}
    try:
        return json.loads(RELEASE_CANDIDATE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def device_matrix_artifact_paths() -> List[str]:
    paths = [
        MATRIX_DOC_PATH,
        RELEASE_CANDIDATE_PATH,
        REPORT_TEMPLATE_PATH,
        FOUNDER_SETUP_PATH,
        RUN_SCRIPT_PS1,
        SMOKE_SCRIPT,
        PRIOR_QA_REPORT,
        TURN_MATRIX_REPORT,
    ]
    return [str(p.relative_to(REPO_ROOT)).replace("\\", "/") for p in paths if p.is_file()]


def matrix_row_ids() -> List[str]:
    return [row["id"] for row in MATRIX_ROWS]


def device_matrix_public_config() -> Dict[str, Any]:
    rc = load_release_candidate()
    complete = _env_flag(DEVICE_MATRIX_ENV)
    report_path = _env(DEVICE_MATRIX_REPORT_ENV, str(REPORT_TEMPLATE_PATH.relative_to(REPO_ROOT)))
    return {
        "matrix_id": MATRIX_ID,
        "minimum_wave": MINIMUM_WAVE_ID,
        "release_candidate_version": rc.get("release_candidate_version") or DEFAULT_RELEASE_CANDIDATE_VERSION,
        "api_url": rc.get("api_url") or DEFAULT_API_URL,
        "matrix_complete": complete,
        "founder_report": report_path,
        "primary_devices": list(PRIMARY_DEVICES),
        "stretch_devices": list(STRETCH_DEVICES),
        "allowed_platforms": list(ALLOWED_PLATFORMS),
        "requirements": list(DEVICE_MATRIX_REQUIREMENTS),
        "matrix_rows": [dict(row) for row in MATRIX_ROWS],
        "preflight_checks": list(PREFLIGHT_CHECKS),
        "artifacts": device_matrix_artifact_paths(),
        "founder_setup": "scripts/DEVICE_MATRIX_SETUP.txt",
        "run_script": "scripts/run_device_matrix.ps1",
        "turn_submatrix": "test_reports/Q31_TURN_OFF_LAN_MATRIX.md",
        "prior_qa_notes": "test_reports/TASK_J_QA_2026-06-27.md",
    }


def validate_matrix_artifacts() -> Tuple[str, ...]:
    """Return missing required artifact paths (repo-relative)."""
    required = [
        MATRIX_DOC_PATH,
        RELEASE_CANDIDATE_PATH,
        REPORT_TEMPLATE_PATH,
        FOUNDER_SETUP_PATH,
        RUN_SCRIPT_PS1,
        SMOKE_SCRIPT,
    ]
    missing = []
    for path in required:
        if not path.is_file():
            missing.append(str(path.relative_to(REPO_ROOT)).replace("\\", "/"))
    return tuple(missing)