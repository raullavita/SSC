"""Engine 1 Step 1.7 — live-server integration checks (requires backend on :8000)."""
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
    return {"X-Forwarded-For": f"10.7.0.{int(SUFFIX, 16) % 200 + 1}"}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_engine1_config_egress_map():
    r = requests.get(f"{API}/config", timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "air_gapped_mode" in data
    assert "egress" in data
    assert data["egress"]["third_party_egress"]
    assert len(data["egress"]["third_party_egress"]) >= 7
    assert data["translation_enabled"] is False


def test_engine1_translate_blocked_by_default():
    r = requests.post(
        f"{API}/translate",
        json={"text": "hello", "target_language": "ro"},
        headers=_auth("dummy"),
        timeout=10,
    )
    assert r.status_code in (401, 403)


def test_engine1_register_users():
    for tag, lang in (("a", "en"), ("b", "ro")):
        payload = {
            "email": f"e1.{tag}.{SUFFIX}@ssc.dev",
            "password": "E1Pass2026!",
            "username": f"e1{tag}{SUFFIX[:3]}",
            "public_key": f"PK_{tag}",
            "encrypted_private_key": f"EPK_{tag}",
            "pk_salt": f"S_{tag}",
            "language": lang,
            "captcha_token": "TEST-TOKEN",
        }
        r = requests.post(f"{API}/auth/register", json=payload, headers=_reg_headers(), timeout=15)
        assert r.status_code == 200, r.text
        state[f"{tag}_token"] = r.json()["token"]
        state[f"{tag}_user"] = r.json()["user"]


def test_engine1_mutual_contacts():
    make_mutual_contacts(
        API,
        state["a_token"],
        state["b_token"],
        state["b_user"]["username"],
    )


def test_engine1_conversation_list_no_ciphertext_leak():
    r = requests.post(
        f"{API}/conversations",
        json={"peer_username": state["b_user"]["username"]},
        headers=_auth(state["a_token"]),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    conv_id = r.json()["conversation_id"]
    state["conv_id"] = conv_id

    msg = {
        "conversation_id": conv_id,
        "ciphertext": "SECRET_CIPHERTEXT_BLOB",
        "iv": "aXY=",
        "encrypted_keys": {
            state["a_user"]["user_id"]: "Aw==",
            state["b_user"]["user_id"]: "Bw==",
        },
        "message_type": "text",
        "plaintext_length": 4,
    }
    r = requests.post(f"{API}/messages", json=msg, headers=_auth(state["a_token"]), timeout=15)
    assert r.status_code == 200, r.text
    assert "expires_at" in r.json()

    r2 = requests.get(f"{API}/conversations", headers=_auth(state["a_token"]), timeout=15)
    assert r2.status_code == 200, r.text
    convs = r2.json()
    assert convs, "expected conversation in list"
    row = next(c for c in convs if c["conversation_id"] == conv_id)
    assert "last_message" not in row
    assert "name" not in row
    assert "last_activity" in row
    assert "ciphertext" not in str(row)


def test_engine1_messages_strip_peer_metadata():
    r = requests.get(
        f"{API}/conversations/{state['conv_id']}/messages",
        headers=_auth(state["b_token"]),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    msgs = r.json()
    assert msgs
    m = msgs[0]
    assert "sender_username" not in m
    assert "plaintext_length" not in m
    assert set(m.get("encrypted_keys", {}).keys()) == {state["b_user"]["user_id"]}