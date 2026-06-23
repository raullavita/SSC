"""Engine 3 Step 3.7 — live-server panic wipe integration (requires backend on :8000)."""
import os
import uuid

import pytest
import requests

from test_helpers import make_mutual_contacts

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"
SUFFIX = uuid.uuid4().hex[:4]


def _server_up() -> bool:
    try:
        r = requests.get(f"{API}/", timeout=3)
        return r.status_code == 200 and r.json().get("status") == "ok"
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _server_up(), reason="backend not running on :8000")

state: dict = {}


def _reg_headers():
    return {"X-Forwarded-For": f"10.9.0.{int(SUFFIX, 16) % 200 + 1}"}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_engine3_register_users():
    for tag, lang in (("a", "en"), ("b", "ro")):
        payload = {
            "email": f"e3.{tag}.{SUFFIX}@ssc.dev",
            "password": "E3Pass2026!",
            "username": f"e3{tag}{SUFFIX[:3]}",
            "public_key": f"PK3_{tag}",
            "encrypted_private_key": f"EPK3_{tag}",
            "pk_salt": f"S3_{tag}",
            "language": lang,
            "captcha_token": "TEST-TOKEN",
        }
        r = requests.post(f"{API}/auth/register", json=payload, headers=_reg_headers(), timeout=15)
        assert r.status_code == 200, r.text
        state[f"{tag}_token"] = r.json()["token"]
        state[f"{tag}_user"] = r.json()["user"]


def test_engine3_mutual_contacts():
    make_mutual_contacts(
        API,
        state["a_token"],
        state["b_token"],
        state["b_user"]["username"],
    )


def test_engine3_create_conversation_and_message():
    r = requests.post(
        f"{API}/conversations",
        json={"peer_username": state["b_user"]["username"]},
        headers=_auth(state["a_token"]),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    state["conv_id"] = r.json()["conversation_id"]
    msg = {
        "conversation_id": state["conv_id"],
        "ciphertext": "Q0lQSEVSVEVYVA==",
        "iv": "aXY=",
        "encrypted_keys": {
            state["a_user"]["user_id"]: "Aw==",
            state["b_user"]["user_id"]: "Bw==",
        },
        "message_type": "text",
    }
    r2 = requests.post(f"{API}/messages", json=msg, headers=_auth(state["a_token"]), timeout=15)
    assert r2.status_code == 200, r2.text


def test_engine3_panic_wipe_clears_chats_preserves_account_and_contacts():
    r = requests.post(f"{API}/panic-wipe", headers=_auth(state["a_token"]), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert body.get("wiped_conversations", 0) >= 1

    r_conv = requests.get(f"{API}/conversations", headers=_auth(state["a_token"]), timeout=15)
    if r_conv.status_code == 200:
        assert r_conv.json() == []

    r_login = requests.post(
        f"{API}/auth/login",
        json={"email": f"e3.a.{SUFFIX}@ssc.dev", "password": "E3Pass2026!"},
        timeout=15,
    )
    assert r_login.status_code == 200, r_login.text
    new_token = r_login.json()["token"]

    r_contacts = requests.get(f"{API}/contacts", headers=_auth(new_token), timeout=15)
    assert r_contacts.status_code == 200
    contact_ids = [c["user_id"] for c in r_contacts.json()]
    assert state["b_user"]["user_id"] in contact_ids