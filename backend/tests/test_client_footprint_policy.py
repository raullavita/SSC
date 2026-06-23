"""Engine 3 Step 3.1 — Client Footprint Charter."""
from pathlib import Path

from core.client_footprint_policy import (
    ENGINE3_STEPS,
    FOOTPRINT_GAPS,
    FOOTPRINT_LOCATIONS,
    FootprintTier,
    engine3_complete,
    location_ids,
    open_gaps,
)
from core.e2e_policy import engine2_complete


def test_engine2_prerequisite_complete():
    assert engine2_complete() is True


def test_engine3_step_31_marked_complete():
    step = next(s for s in ENGINE3_STEPS if s[0] == "3.1")
    assert step[2] is True


def test_engine3_step_32_marked_complete():
    step = next(s for s in ENGINE3_STEPS if s[0] == "3.2")
    assert step[2] is True


def test_engine3_step_33_marked_complete():
    step = next(s for s in ENGINE3_STEPS if s[0] == "3.3")
    assert step[2] is True


def test_engine3_step_34_marked_complete():
    step = next(s for s in ENGINE3_STEPS if s[0] == "3.4")
    assert step[2] is True


def test_engine3_step_35_marked_complete():
    step = next(s for s in ENGINE3_STEPS if s[0] == "3.5")
    assert step[2] is True


def test_engine3_step_36_marked_complete():
    step = next(s for s in ENGINE3_STEPS if s[0] == "3.6")
    assert step[2] is True


def test_engine3_step_37_marked_complete():
    step = next(s for s in ENGINE3_STEPS if s[0] == "3.7")
    assert step[2] is True


def test_c1_c2_resolved():
    open_ids = {g.gap_id for g in open_gaps()}
    assert "C1" not in open_ids
    assert "C2" not in open_ids


def test_c4_resolved():
    open_ids = {g.gap_id for g in open_gaps()}
    assert "C4" not in open_ids


def test_c5_resolved():
    open_ids = {g.gap_id for g in open_gaps()}
    assert "C5" not in open_ids


def test_c6_resolved():
    open_ids = {g.gap_id for g in open_gaps()}
    assert "C6" not in open_ids


def test_c3_c7_resolved():
    open_ids = {g.gap_id for g in open_gaps()}
    assert "C3" not in open_ids
    assert "C7" not in open_ids


def test_only_c8_gap_remains_open_for_engine3():
    open_ids = {g.gap_id for g in open_gaps()}
    engine3_open = {g.gap_id for g in open_gaps() if g.engine3_step}
    assert engine3_open == set()
    assert "C8" in open_ids


def test_engine3_fully_complete():
    assert engine3_complete() is True


def test_client_footprint_charter_exists_and_covers_locations():
    charter = Path(__file__).resolve().parents[2] / "memory" / "CLIENT_FOOTPRINT_CHARTER.md"
    assert charter.is_file()
    text = charter.read_text(encoding="utf-8").lower()
    for loc_id in location_ids():
        loc = FOOTPRINT_LOCATIONS[loc_id]
        tokens = [
            loc_id.replace("_", " "),
            loc.store.lower(),
            *loc.keys_or_content.lower().replace(".", " ").replace("_", " ").split(),
        ]
        assert any(tok and tok in text for tok in tokens), f"Charter must discuss {loc_id}"


def test_all_gaps_documented_in_charter():
    charter = Path(__file__).resolve().parents[2] / "memory" / "CLIENT_FOOTPRINT_CHARTER.md"
    text = charter.read_text(encoding="utf-8")
    for gap in FOOTPRINT_GAPS:
        assert gap.gap_id in text, f"Charter must list gap {gap.gap_id}"


def test_open_gaps_have_engine_assignment():
    for gap in open_gaps():
        assert gap.engine3_step or gap.later_engine, gap.gap_id


def test_policy_module_docstring_points_to_charter():
    import core.client_footprint_policy as mod
    assert "CLIENT_FOOTPRINT_CHARTER" in (mod.__doc__ or "")


def test_jwt_and_private_key_are_secret_tier():
    assert FOOTPRINT_LOCATIONS["local_storage_jwt"].tier == FootprintTier.SECRET
    assert FOOTPRINT_LOCATIONS["react_private_key"].tier == FootprintTier.SECRET


def test_decrypted_messages_ephemeral_tier():
    assert FOOTPRINT_LOCATIONS["react_decrypted_messages"].tier == FootprintTier.EPHEMERAL


def test_ui_lang_preference_survives_panic():
    loc = FOOTPRINT_LOCATIONS["local_storage_ui_lang"]
    assert loc.tier == FootprintTier.PREFERENCE
    assert loc.panic_action == "keep"


def test_retention_charter_references_engine3():
    retention = Path(__file__).resolve().parents[2] / "memory" / "RETENTION_CHARTER.md"
    text = retention.read_text(encoding="utf-8")
    assert "CLIENT_FOOTPRINT_CHARTER" in text or "Engine 3" in text