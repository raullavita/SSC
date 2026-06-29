import os
import uuid

import pytest
import requests
from fastapi import HTTPException

from core.broadcast_lists import (
    MAX_BROADCAST_RECIPIENTS,
    broadcast_lists_public_config,
    normalize_broadcast_list_name,
    normalize_recipient_ids,
    project_broadcast_list_for_api,
)
from test_helpers import auth_headers, make_mutual_contacts

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


def _server_available() -> bool:
    try:
        r = requests.get(f"{API}/", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


requires_server = pytest.mark.skipif(not _server_available(), reason="backend not running")


def test_broadcast_lists_public_config():
    cfg = broadcast_lists_public_config()
    assert cfg["max_lists"] == 20
    assert cfg["max_recipients"] == MAX_BROADCAST_RECIPIENTS


def test_normalize_broadcast_list_name_rejects_empty():
    with pytest.raises(HTTPException):
        normalize_broadcast_list_name("  ")


def test_normalize_recipient_ids_dedupes():
    assert normalize_recipient_ids(["u_b", "u_a", "u_b"]) == ["u_a", "u_b"]


def test_normalize_recipient_ids_rejects_too_many():
    with pytest.raises(HTTPException):
        normalize_recipient_ids([f"u_{i}" for i in range(MAX_BROADCAST_RECIPIENTS + 1)])


def test_project_broadcast_list_for_api():
    out = project_broadcast_list_for_api({
        "list_id": "bl_test",
        "name": "Team",
        "recipient_ids": ["u_a"],
        "created_at": "2026-06-29T10:00:00+00:00",
        "updated_at": "2026-06-29T10:00:00+00:00",
    })
    assert out["list_id"] == "bl_test"
    assert out["recipient_ids"] == ["u_a"]


def _register_user(tag: str) -> dict:
    suffix = uuid.uuid4().hex[:5]
    payload = {
        "email": f"bl_{tag}_{suffix}@ssc.dev",
        "password": "BlPass2026!",
        "username": f"bl{tag}{suffix[:3]}",
        "public_key": f"PUB_{tag}",
        "encrypted_private_key": f"ENC_{tag}",
        "pk_salt": f"SALT_{tag}",
        "language": "en",
        "captcha_token": "TEST-TOKEN",
    }
    r = requests.post(
        f"{API}/auth/register",
        json=payload,
        headers={"X-Forwarded-For": f"10.9.0.{int(suffix, 16) % 200 + 1}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    return {
        "token": body["token"],
        "user_id": body["user"]["user_id"],
        "username": body["user"]["username"],
    }


@requires_server
def test_broadcast_lists_api_crud():
    owner = _register_user("own")
    peer = _register_user("peer")
    make_mutual_contacts(API, owner["token"], peer["token"], peer["username"])

    r_create = requests.post(
        f"{API}/broadcast-lists",
        json={"name": "Team", "recipient_ids": [peer["user_id"]]},
        headers=auth_headers(owner["token"]),
        timeout=15,
    )
    assert r_create.status_code == 200, r_create.text
    created = r_create.json()
    assert created["name"] == "Team"
    assert peer["user_id"] in created["recipient_ids"]
    list_id = created["list_id"]

    r_list = requests.get(f"{API}/broadcast-lists", headers=auth_headers(owner["token"]), timeout=15)
    assert r_list.status_code == 200
    assert any(row["list_id"] == list_id for row in r_list.json())

    r_patch = requests.patch(
        f"{API}/broadcast-lists/{list_id}",
        json={"name": "Squad"},
        headers=auth_headers(owner["token"]),
        timeout=15,
    )
    assert r_patch.status_code == 200, r_patch.text
    assert r_patch.json()["name"] == "Squad"

    r_delete = requests.delete(
        f"{API}/broadcast-lists/{list_id}",
        headers=auth_headers(owner["token"]),
        timeout=15,
    )
    assert r_delete.status_code == 200, r_delete.text
    assert r_delete.json()["ok"] is True


@requires_server
def test_broadcast_lists_rejects_non_contact():
    owner = _register_user("o2")
    stranger = _register_user("s2")
    r = requests.post(
        f"{API}/broadcast-lists",
        json={"name": "Bad", "recipient_ids": [stranger["user_id"]]},
        headers=auth_headers(owner["token"]),
        timeout=15,
    )
    assert r.status_code == 403, r.text