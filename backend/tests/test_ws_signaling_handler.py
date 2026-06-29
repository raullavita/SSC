"""WS handler signaling-error helpers — issue #4 review."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def test_ws_handler_exports_signaling_error_helpers():
    text = (REPO / "backend" / "routers" / "ws_handler.py").read_text(encoding="utf-8")
    assert "async def _send_signaling_error" in text
    assert "async def _group_members_permitted" in text
    assert '"detail": "recipient required"' in text or "recipient required" in text
    assert "group member not permitted" in text


def test_ws_handler_validates_members_before_relay():
    text = (REPO / "backend" / "routers" / "ws_handler.py").read_text(encoding="utf-8")
    assert "_group_members_permitted" in text
    assert "validate_signaling_relay(data)" in text
    idx_members = text.index("_group_members_permitted")
    idx_validate = text.index("validate_signaling_relay(data)")
    assert idx_members < idx_validate, "member permission should be checked before payload validation"