"""SSC backend iteration 3 tests:
- /api/config version 0.3
- POST /messages encrypted_keys validation (covers ALL participants)
- /api/contacts dedup
- Statuses CRUD + per-viewer encrypted_keys gating + TTL index
- WebSocket status-new notification
- WebSocket call-offer `group: true` signal_v1 passthrough
"""
import os
import json
import time
import uuid
import base64
import asyncio
import pytest
import requests
import websockets

from test_helpers import make_mutual_contacts, ws_connect_url

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
WS_URL = f"{WS_BASE}/api/ws"

SUFFIX = uuid.uuid4().hex[:4]
CAPTCHA = "TEST-TOKEN"


def _user(tag, idx):
    return {
        "email": f"i3{tag}+{SUFFIX}@ssc.dev",
        "password": "Pass2026!Strong",
        "username": f"i3{tag}{SUFFIX[:3]}",
        "public_key": f"PK_{tag}",
        "encrypted_private_key": f"EPK_{tag}",
        "pk_salt": f"S_{tag}",
        "language": "en",
        "captcha_token": CAPTCHA,
    }


USERS = {"a": _user("a", 0), "b": _user("b", 1), "c": _user("c", 2), "d": _user("d", 3)}
state = {}


def auth_h(t):
    return {"Authorization": f"Bearer {t}"}


def _register(key, ip):
    r = requests.post(f"{API}/auth/register", json=USERS[key], headers={"X-Forwarded-For": ip})
    assert r.status_code == 200, f"register {key}: {r.status_code} {r.text}"
    body = r.json()
    state[f"{key}_token"] = body["token"]
    state[f"{key}_user"] = body["user"]


# ─── Setup: register 4 users ─────────────────────────────────────────────
def test_setup_register_users():
    for i, k in enumerate(USERS.keys()):
        _register(k, ip=f"10.3.0.{20+i}")


# ─── Mutual contacts (required before conversations) ─────────────────────
def test_establish_contacts():
    make_mutual_contacts(API, state["a_token"], state["b_token"], USERS["b"]["username"])
    make_mutual_contacts(API, state["a_token"], state["c_token"], USERS["c"]["username"])


# ─── /api/config version 0.3 ─────────────────────────────────────────────
def test_config_version_03():
    r = requests.get(f"{API}/config")
    assert r.status_code == 200
    data = r.json()
    assert data.get("version") in ("0.3", "0.4-standalone"), data
    assert "turnstile_sitekey" in data
    assert "vapid_public_key" in data


# ─── /api/contacts ───────────────────────────────────────────────────────
def test_contacts_empty_for_isolated_user():
    # user d has no conversations yet
    r = requests.get(f"{API}/contacts", headers=auth_h(state["d_token"]))
    assert r.status_code == 200
    assert r.json() == []


def test_contacts_after_dm():
    # a creates DM with b
    r = requests.post(f"{API}/conversations", json={"peer_username": USERS["b"]["username"]},
                      headers=auth_h(state["a_token"]))
    assert r.status_code == 200, r.text
    state["dm_ab"] = r.json()["conversation_id"]

    r2 = requests.get(f"{API}/contacts", headers=auth_h(state["a_token"]))
    assert r2.status_code == 200
    contacts = r2.json()
    uids = [u["user_id"] for u in contacts]
    assert state["b_user"]["user_id"] in uids
    assert state["a_user"]["user_id"] not in uids  # self excluded


def test_contacts_dedup_and_group_members():
    # a creates group with b, c
    r = requests.post(
        f"{API}/conversations",
        json={"is_group": True, "name": "G1",
              "peer_usernames": [USERS["b"]["username"], USERS["c"]["username"]]},
        headers=auth_h(state["a_token"]),
    )
    assert r.status_code == 200, r.text
    state["group_abc"] = r.json()["conversation_id"]

    r2 = requests.get(f"{API}/contacts", headers=auth_h(state["a_token"]))
    contacts = r2.json()
    uids = [u["user_id"] for u in contacts]
    # b appears in both dm and group but should be unique
    assert uids.count(state["b_user"]["user_id"]) == 1
    assert state["c_user"]["user_id"] in uids
    assert state["a_user"]["user_id"] not in uids


# ─── POST /messages encrypted_keys validation ────────────────────────────
def test_message_missing_key_for_peer_rejected():
    # DM ab; alice only includes herself
    body = {
        "conversation_id": state["dm_ab"],
        "ciphertext": base64.b64encode(b"ct").decode(),
        "iv": base64.b64encode(b"iv").decode(),
        "encrypted_keys": {state["a_user"]["user_id"]: "Aw=="},
        "message_type": "text",
    }
    r = requests.post(f"{API}/messages", json=body, headers=auth_h(state["a_token"]))
    assert r.status_code == 400, r.text
    detail = (r.json().get("detail") or "").lower()
    assert "encrypted_keys missing" in detail, r.text


def test_message_with_all_keys_accepted_dm():
    body = {
        "conversation_id": state["dm_ab"],
        "ciphertext": base64.b64encode(b"hi").decode(),
        "iv": base64.b64encode(b"ivv").decode(),
        "encrypted_keys": {
            state["a_user"]["user_id"]: "Aw==",
            state["b_user"]["user_id"]: "Bw==",
        },
        "message_type": "text",
    }
    r = requests.post(f"{API}/messages", json=body, headers=auth_h(state["a_token"]))
    assert r.status_code == 200, r.text


def test_message_group_partial_keys_rejected():
    # group abc with only a + b keys -> missing c
    body = {
        "conversation_id": state["group_abc"],
        "ciphertext": base64.b64encode(b"g").decode(),
        "iv": base64.b64encode(b"ivg").decode(),
        "encrypted_keys": {
            state["a_user"]["user_id"]: "Aw==",
            state["b_user"]["user_id"]: "Bw==",
        },
        "message_type": "text",
    }
    r = requests.post(f"{API}/messages", json=body, headers=auth_h(state["a_token"]))
    assert r.status_code == 400, r.text
    assert "encrypted_keys missing" in (r.json().get("detail") or "").lower()


def test_message_group_all_keys_accepted():
    body = {
        "conversation_id": state["group_abc"],
        "ciphertext": base64.b64encode(b"g2").decode(),
        "iv": base64.b64encode(b"ivg2").decode(),
        "encrypted_keys": {
            state["a_user"]["user_id"]: "Aw==",
            state["b_user"]["user_id"]: "Bw==",
            state["c_user"]["user_id"]: "Cw==",
        },
        "message_type": "text",
    }
    r = requests.post(f"{API}/messages", json=body, headers=auth_h(state["a_token"]))
    assert r.status_code == 200, r.text


# ─── Statuses ────────────────────────────────────────────────────────────
def test_create_status_requires_author_in_keys():
    body = {
        "ciphertext": base64.b64encode(b"st-no-author").decode(),
        "iv": base64.b64encode(b"iv-st").decode(),
        "encrypted_keys": {state["b_user"]["user_id"]: "Bw=="},  # author 'a' missing
        "status_type": "text",
    }
    r = requests.post(f"{API}/statuses", json=body, headers=auth_h(state["a_token"]))
    assert r.status_code == 400, r.text
    detail = (r.json().get("detail") or "").lower()
    assert "author" in detail


def test_create_status_success():
    body = {
        "ciphertext": base64.b64encode(b"hello-status").decode(),
        "iv": base64.b64encode(b"iv-hs").decode(),
        "encrypted_keys": {
            state["a_user"]["user_id"]: "Aw==",
            state["b_user"]["user_id"]: "Bw==",
        },
        "status_type": "text",
        "background": "#112233",
    }
    r = requests.post(f"{API}/statuses", json=body, headers=auth_h(state["a_token"]))
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["status_id"].startswith("s_")
    assert doc["author_id"] == state["a_user"]["user_id"]
    assert "expires_at" in doc and doc["expires_at"]
    assert doc["background"] == "#112233"
    state["status_id"] = doc["status_id"]


def test_list_statuses_visible_to_viewer():
    # b is in encrypted_keys -> can see it
    r = requests.get(f"{API}/statuses", headers=auth_h(state["b_token"]))
    assert r.status_code == 200
    ids = [s["status_id"] for s in r.json()]
    assert state["status_id"] in ids


def test_list_statuses_hidden_from_non_recipient():
    # c is NOT in encrypted_keys -> must not see it
    r = requests.get(f"{API}/statuses", headers=auth_h(state["c_token"]))
    assert r.status_code == 200
    ids = [s["status_id"] for s in r.json()]
    assert state["status_id"] not in ids


def test_list_statuses_author_sees_own():
    r = requests.get(f"{API}/statuses", headers=auth_h(state["a_token"]))
    assert r.status_code == 200
    ids = [s["status_id"] for s in r.json()]
    assert state["status_id"] in ids


def test_mark_status_viewed_idempotent():
    sid = state["status_id"]
    # b marks viewed twice
    for _ in range(2):
        r = requests.post(f"{API}/statuses/viewed", json={"status_id": sid},
                          headers=auth_h(state["b_token"]))
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    # author a fetches and sees viewers list has b exactly once
    r2 = requests.get(f"{API}/statuses", headers=auth_h(state["a_token"]))
    own = next(s for s in r2.json() if s["status_id"] == sid)
    viewers = own.get("viewers") or []
    assert viewers.count(state["b_user"]["user_id"]) == 1


def test_mark_status_viewed_rejected_for_non_recipient():
    # c is not in encrypted_keys — cannot mark viewed
    sid = state["status_id"]
    r = requests.post(f"{API}/statuses/viewed", json={"status_id": sid},
                      headers=auth_h(state["c_token"]))
    assert r.status_code == 404
    r2 = requests.get(f"{API}/statuses", headers=auth_h(state["a_token"]))
    own = next(s for s in r2.json() if s["status_id"] == sid)
    assert state["c_user"]["user_id"] not in (own.get("viewers") or [])


def test_delete_status_non_author_404():
    sid = state["status_id"]
    r = requests.delete(f"{API}/statuses/{sid}", headers=auth_h(state["b_token"]))
    assert r.status_code == 404


def test_delete_status_author_200():
    sid = state["status_id"]
    r = requests.delete(f"{API}/statuses/{sid}", headers=auth_h(state["a_token"]))
    assert r.status_code == 200
    assert r.json().get("ok") is True
    # gone
    r2 = requests.get(f"{API}/statuses", headers=auth_h(state["a_token"]))
    ids = [s["status_id"] for s in r2.json()]
    assert sid not in ids


# ─── TTL index on statuses.expires_at ────────────────────────────────────
@pytest.mark.asyncio
async def test_statuses_ttl_index():
    from conftest import mongo_client

    cli = mongo_client()
    db = cli[os.environ.get("DB_NAME", "test_database")]
    indexes = await db.statuses.index_information()
    cli.close()
    ttl_found = False
    for name, info in indexes.items():
        keys = info.get("key", [])
        if any(k[0] == "expires_at" for k in keys) and "expireAfterSeconds" in info:
            ttl_found = True
            assert info["expireAfterSeconds"] == 0
    assert ttl_found, f"No TTL index on statuses.expires_at: {indexes}"


# ─── WebSocket: status-new notification ──────────────────────────────────
@pytest.mark.asyncio
async def test_ws_status_new_notification():
    a_token = state["a_token"]
    b_token = state["b_token"]
    b_url = ws_connect_url(API, WS_BASE, b_token)
    async with websockets.connect(b_url) as b_ws:
        greet = await asyncio.wait_for(b_ws.recv(), timeout=5)
        assert json.loads(greet)["type"] == "connected"

        # a posts a status with b as recipient (via HTTP, off the loop)
        body = {
            "ciphertext": base64.b64encode(b"new-status").decode(),
            "iv": base64.b64encode(b"iv-ns").decode(),
            "encrypted_keys": {
                state["a_user"]["user_id"]: "Aw==",
                state["b_user"]["user_id"]: "Bw==",
            },
            "status_type": "text",
        }
        resp = await asyncio.get_event_loop().run_in_executor(
            None, lambda: requests.post(f"{API}/statuses", json=body, headers=auth_h(a_token))
        )
        assert resp.status_code == 200, resp.text
        expected_sid = resp.json()["status_id"]

        # b should receive 'status-new'
        deadline = time.time() + 5
        got = None
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(b_ws.recv(), timeout=2)
            except asyncio.TimeoutError:
                break
            obj = json.loads(raw)
            if obj.get("type") == "status-new":
                got = obj
                break
        assert got is not None, "B did not receive status-new"
        data = got.get("data") or {}
        assert data.get("status_id") == expected_sid
        assert data.get("author_id") == state["a_user"]["user_id"]

        # cleanup
        requests.delete(f"{API}/statuses/{expected_sid}", headers=auth_h(a_token))


# ─── WebSocket: call-offer `group: true` signal_v1 passthrough ───────────
_VALID_SIGNAL_CT = base64.b64encode(b"x" * 32).decode("ascii")


@pytest.mark.asyncio
async def test_ws_call_offer_group_passthrough():
    a_token = state["a_token"]
    b_token = state["b_token"]
    a_url = ws_connect_url(API, WS_BASE, a_token)
    b_url = ws_connect_url(API, WS_BASE, b_token)
    dist_id = str(uuid.uuid4())
    async with websockets.connect(a_url) as a_ws, \
               websockets.connect(b_url) as b_ws:
        for ws in (a_ws, b_ws):
            greet = await asyncio.wait_for(ws.recv(), timeout=5)
            assert json.loads(greet)["type"] == "connected"

        members = [state["a_user"]["user_id"], state["b_user"]["user_id"], state["c_user"]["user_id"]]
        await a_ws.send(json.dumps({
            "type": "call-offer",
            "to": state["b_user"]["user_id"],
            "group": True,
            "mode": "audio",
            "signaling_protocol": "signal_v1",
            "signaling_ciphertext": _VALID_SIGNAL_CT,
            "signal_message_type": 7,
            "distribution_id": dist_id,
            "members": members,
            "call_id": "cg1",
        }))

        deadline = time.time() + 5
        got = None
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(b_ws.recv(), timeout=2)
            except asyncio.TimeoutError:
                break
            obj = json.loads(raw)
            if obj.get("type") == "call-offer":
                got = obj
                break
        assert got is not None, "B did not receive call-offer"
        assert got.get("group") is True, got
        assert got.get("mode") == "audio"
        assert got.get("members") == members
        assert got.get("from") == state["a_user"]["user_id"]
        assert got.get("signaling_protocol") == "signal_v1"
        assert got.get("signaling_ciphertext") == _VALID_SIGNAL_CT
        assert got.get("signal_message_type") == 7
        assert got.get("distribution_id") == dist_id
        assert not got.get("sdp")
