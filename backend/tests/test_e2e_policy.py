"""Engine 2 Step 2.1 — E2E integrity charter."""
from pathlib import Path

from core.e2e_policy import (
    E2E_SURFACES,
    ENGINE2_STEPS,
    INTEGRITY_GAPS,
    E2EStatus,
    engine1_complete,
    open_gaps,
    surface_names,
)


def test_engine1_prerequisite_complete():
    assert engine1_complete() is True


def test_engine2_step_21_marked_complete():
    step = next(s for s in ENGINE2_STEPS if s[0] == "2.1")
    assert step[2] is True


def test_e2e_charter_exists_and_covers_surfaces():
    charter = Path(__file__).resolve().parents[2] / "memory" / "E2E_INTEGRITY_CHARTER.md"
    assert charter.is_file()
    text = charter.read_text(encoding="utf-8")
    lower = text.lower()
    for name in surface_names():
        assert (
            name in lower
            or name.replace("_", " ") in lower
            or name.replace("_", "/") in lower
        ), f"Charter must discuss {name}"


def test_all_gaps_documented_in_charter():
    charter = Path(__file__).resolve().parents[2] / "memory" / "E2E_INTEGRITY_CHARTER.md"
    text = charter.read_text(encoding="utf-8")
    for gap in INTEGRITY_GAPS:
        assert gap.gap_id in text, f"Charter must list gap {gap.gap_id}"


def test_messages_surface_enforced():
    assert E2E_SURFACES["messages"].status == E2EStatus.ENFORCED


def test_translation_not_e2e():
    assert E2E_SURFACES["translation"].status == E2EStatus.NOT_E2E


def test_open_gaps_have_engine_assignment():
    for gap in open_gaps():
        assert gap.engine2_step or gap.later_engine, gap.gap_id


def test_policy_module_docstring_points_to_charter():
    import core.e2e_policy as mod
    assert "E2E_INTEGRITY_CHARTER" in (mod.__doc__ or "")


def test_engine2_step_22_marked_complete():
    step = next(s for s in ENGINE2_STEPS if s[0] == "2.2")
    assert step[2] is True


def test_engine2_step_23_marked_complete():
    step = next(s for s in ENGINE2_STEPS if s[0] == "2.3")
    assert step[2] is True


def test_engine2_step_24_marked_complete():
    step = next(s for s in ENGINE2_STEPS if s[0] == "2.4")
    assert step[2] is True


def test_engine2_step_25_marked_complete():
    step = next(s for s in ENGINE2_STEPS if s[0] == "2.5")
    assert step[2] is True


def test_engine2_step_26_marked_complete():
    step = next(s for s in ENGINE2_STEPS if s[0] == "2.6")
    assert step[2] is True


def test_engine2_step_27_marked_complete():
    step = next(s for s in ENGINE2_STEPS if s[0] == "2.7")
    assert step[2] is True


def test_engine2_complete():
    from core.e2e_policy import engine2_complete
    assert engine2_complete() is True


def test_g1_g2_g3_g4_g5_g7_g8_resolved():
    open_ids = {g.gap_id for g in open_gaps()}
    assert "G1" not in open_ids
    assert "G2" not in open_ids
    assert "G3" not in open_ids
    assert "G4" not in open_ids
    assert "G5" not in open_ids
    assert "G7" not in open_ids
    assert "G8" not in open_ids


def test_files_surface_enforced():
    assert E2E_SURFACES["files"].status == E2EStatus.ENFORCED


def test_files_route_no_query_auth_param():
    text = (Path(__file__).resolve().parents[1] / "routers" / "files.py").read_text(encoding="utf-8")
    assert "Query(None)" not in text
    assert 'auth: Optional[str] = Query' not in text
    assert "get_current_user" in text


def test_frontend_no_file_url_with_jwt():
    root = Path(__file__).resolve().parents[2]
    api_js = (root / "frontend" / "src" / "lib" / "api.js").read_text(encoding="utf-8")
    files_js = (root / "frontend" / "src" / "lib" / "files.js").read_text(encoding="utf-8")
    assert "fileUrl" not in api_js
    assert "?auth=" not in api_js
    assert "fetchFileBlob" in files_js


def test_auth_context_memory_only_vault():
    root = Path(__file__).resolve().parents[2]
    auth = (root / "frontend" / "src" / "context" / "AuthContext.jsx").read_text(encoding="utf-8")
    vault = (root / "frontend" / "src" / "lib" / "vault.js").read_text(encoding="utf-8")
    assert "ssc_pk_jwk" not in auth
    assert "ssc_pk_unlocked" not in auth
    assert "purgeLegacyPrivateKeyFromSession" in auth
    assert "LEGACY_SESSION_PK_KEYS" in vault


def test_client_key_storage_excludes_session_pk():
    from core.e2e_policy import CLIENT_KEY_STORAGE
    assert "sessionStorage.ssc_pk_jwk" not in CLIENT_KEY_STORAGE