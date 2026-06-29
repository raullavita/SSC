"""Q.64 — TASK J device matrix policy tests."""
from pathlib import Path

from core.device_matrix_policy import (
    DEVICE_MATRIX_REQUIREMENTS,
    MATRIX_ID,
    MATRIX_ROWS,
    MINIMUM_WAVE_ID,
    PRIMARY_DEVICES,
    device_matrix_artifact_paths,
    device_matrix_public_config,
    matrix_row_ids,
    validate_matrix_artifacts,
)

REPO = Path(__file__).resolve().parents[2]


def test_matrix_id_and_minimum_wave():
    assert MATRIX_ID == "Q.64"
    assert MINIMUM_WAVE_ID == "Q.15"


def test_primary_devices():
    assert PRIMARY_DEVICES == ("tester-win", "tester-android")


def test_matrix_rows_count_and_unique_ids():
    assert len(MATRIX_ROWS) == 19
    ids = matrix_row_ids()
    assert len(ids) == len(set(ids))


def test_matrix_artifacts_exist():
    missing = validate_matrix_artifacts()
    assert not missing, f"missing: {missing}"


def test_artifact_paths_include_matrix_and_report():
    paths = device_matrix_artifact_paths()
    assert "device-matrix/MATRIX.md" in paths
    assert "test_reports/Q64_DEVICE_MATRIX.md" in paths
    assert "scripts/DEVICE_MATRIX_SETUP.txt" in paths


def test_device_matrix_public_config_shape():
    cfg = device_matrix_public_config()
    assert cfg["matrix_id"] == "Q.64"
    assert cfg["minimum_wave"] == "Q.15"
    assert cfg["matrix_complete"] is False
    assert len(cfg["matrix_rows"]) == 19
    assert len(cfg["requirements"]) == len(DEVICE_MATRIX_REQUIREMENTS)
    assert cfg["primary_devices"] == ["tester-win", "tester-android"]


def test_config_route_exposes_device_matrix():
    from routers.config_route import public_config
    import asyncio

    data = asyncio.run(public_config())
    assert "device_matrix" in data
    dm = data["device_matrix"]
    assert dm["matrix_id"] == "Q.64"
    assert len(dm["matrix_rows"]) == 19


def test_release_candidate_json_valid():
    import json

    path = REPO / "device-matrix/RELEASE_CANDIDATE.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["matrix_id"] == "Q.64"
    assert len(data["primary_devices"]) == 2
    assert data["founder_report"] == "test_reports/Q64_DEVICE_MATRIX.md"


def test_run_script_references_smoke():
    text = (REPO / "scripts/run_device_matrix.ps1").read_text(encoding="utf-8")
    assert "device_matrix_smoke.py" in text
    assert "Q64_DEVICE_MATRIX.md" in text


def test_roadmap_lists_q64():
    roadmap = (REPO / "memory/SSC-ROADMAP.md").read_text(encoding="utf-8")
    assert "Q.64" in roadmap
    assert "TASK J" in roadmap