"""Username policy tests — Step 10."""

from __future__ import annotations

from core.username_policy import (
    invite_web_url,
    normalize_username,
    public_user_lookup,
    resolve_lookup_target,
    validate_username,
)


def test_normalize_username():
    assert normalize_username("@Alice") == "alice"
    assert normalize_username("  bob  ") == "bob"


def test_validate_username_rules():
    assert validate_username("ab") == "username_length"
    assert validate_username("1bad") == "username_invalid"
    assert validate_username("admin") == "username_reserved"
    assert validate_username("alice") is None


def test_resolve_lookup_target():
    assert resolve_lookup_target("u_abc") == ("id", "u_abc")
    assert resolve_lookup_target("@alice") == ("username", "alice")
    assert resolve_lookup_target("alice") == ("username", "alice")


def test_public_user_lookup_includes_username():
    doc = {"_id": "u_x", "display_name": "Alice", "username": "alice"}
    assert public_user_lookup(doc) == {
        "id": "u_x",
        "display_name": "Alice",
        "username": "alice",
    }


def test_invite_web_url():
    assert invite_web_url("alice") == "https://www.supersecurechat.com/add/alice"