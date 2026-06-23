"""SSC backend end-to-end pytest suite."""
import os
import io
import json
import time
import uuid
import asyncio
import pytest
import requests
import websockets

from test_helpers import make_mutual_contacts

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"


# Unique suffix to avoid collision on re-runs
SUFFIX = uuid.uuid4().hex[:4]

ALICE = {
    "email": f"alice.test+{SUFFIX}@ssc.dev",
    "password": "AlicePass2026!",
    "username": f"alic{SUFFIX[:3]}",  # 7 chars, starts with letter -> valid (avoid alice -> not banned but try simple)
    "public_key": "PUBKEY_ALICE_BASE64",
    "encrypted_private_key": "ENC_PRIV_ALICE",
    "pk_salt": "SALT_ALICE",
    "language": "en",
    "captcha_token": "TEST-TOKEN",
}
BOB = {
    "email": f"bob.test+{SUFFIX}@ssc.dev",
    "password": "BobPass2026!",
    "username": f"bobt{SUFFIX[:3]}",  # 7 chars
    "public_key": "PUBKEY_BOB_BASE64",
    "encrypted_private_key": "ENC_PRIV_BOB",
    "pk_salt": "SALT_BOB",
    "language": "ro",
    "captcha_token": "TEST-TOKEN",
}

state = {}

# Dedicated IP so register rate limits do not collide with other test modules.
REG_HEADERS = {"X-Forwarded-For": f"10.0.0.{int(SUFFIX, 16) % 200 + 10}"}


# ─── Health ─────────────────────────────────────────────────────────────
def test_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "ok"


# ─── Username validation ────────────────────────────────────────────────
@pytest.mark.parametrize("username,expected_available", [
    ("alice_t", True),
    ("bob_t", True),
])
def test_username_available(username, expected_available):
    # only check shape - if already taken from previous run, also acceptable as "rule = taken"
    r = requests.post(f"{API}/auth/check-username", json={"username": username})
    assert r.status_code == 200
    data = r.json()
    if expected_available and not data["available"]:
        # If taken from earlier run, reason should mention 'taken'
        assert "taken" in data.get("reason", "").lower(), data


@pytest.mark.parametrize("username", [
    "ssc_admin", "admin", "ADMIN", "SSC", "ssctest", "fuckyou", "xyz", "noemoji_\U0001F600",
])
def test_username_rejected(username):
    r = requests.post(f"{API}/auth/check-username", json={"username": username})
    assert r.status_code == 200
    data = r.json()
    assert data["available"] is False, f"{username} should be rejected: {data}"
    assert data.get("reason"), f"missing reason for {username}"


# ─── Registration ───────────────────────────────────────────────────────
def test_register_alice():
    r = requests.post(f"{API}/auth/register", json=ALICE, headers=REG_HEADERS)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "token" in body and "user" in body
    assert body["user"]["username"] == ALICE["username"]
    assert body["user"]["email"] == ALICE["email"].lower()
    assert "password_hash" not in body["user"]
    state["alice_token"] = body["token"]
    state["alice_user"] = body["user"]


def test_register_bob():
    r = requests.post(f"{API}/auth/register", json=BOB, headers=REG_HEADERS)
    assert r.status_code == 200, r.text
    body = r.json()
    state["bob_token"] = body["token"]
    state["bob_user"] = body["user"]


def test_register_duplicate_email():
    r = requests.post(f"{API}/auth/register", json=ALICE, headers=REG_HEADERS)
    assert r.status_code == 409


def test_register_duplicate_username():
    payload = dict(ALICE)
    payload["email"] = f"new+{SUFFIX}@ssc.dev"
    r = requests.post(f"{API}/auth/register", json=payload, headers=REG_HEADERS)
    assert r.status_code == 409


def test_register_invalid_username():
    payload = dict(ALICE)
    payload["email"] = f"new2+{SUFFIX}@ssc.dev"
    payload["username"] = "admin"
    r = requests.post(f"{API}/auth/register", json=payload, headers=REG_HEADERS)
    assert r.status_code == 400


# ─── Login ──────────────────────────────────────────────────────────────
def test_login_success():
    r = requests.post(f"{API}/auth/login", json={"email": ALICE["email"], "password": ALICE["password"]})
    assert r.status_code == 200
    assert "token" in r.json()


def test_login_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"email": ALICE["email"], "password": "WrongPass!"})
    assert r.status_code == 401


# ─── /auth/me ───────────────────────────────────────────────────────────
def test_me_with_token():
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    r = requests.get(f"{API}/auth/me", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == ALICE["username"]
    assert "password_hash" not in body


def test_me_without_token():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


# ─── User search ────────────────────────────────────────────────────────
def test_user_search():
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    prefix = ALICE["username"][:3]
    r = requests.get(f"{API}/users/search", params={"q": prefix}, headers=headers)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    # alice should not appear in her own search results
    usernames = [u["username"] for u in arr]
    assert ALICE["username"] not in usernames


# ─── Contacts (required before 1:1 conversations) ───────────────────────
def test_make_alice_bob_contacts():
    make_mutual_contacts(API, state["alice_token"], state["bob_token"], BOB["username"])


# ─── Conversations ──────────────────────────────────────────────────────
def test_create_conversation():
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    r = requests.post(f"{API}/conversations", json={"peer_username": BOB["username"]}, headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "conversation_id" in body
    state["conv_id"] = body["conversation_id"]


def test_create_conversation_idempotent():
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    r = requests.post(f"{API}/conversations", json={"peer_username": BOB["username"]}, headers=headers)
    assert r.status_code == 200
    assert r.json()["conversation_id"] == state["conv_id"]


def test_conversation_with_self_rejected():
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    r = requests.post(f"{API}/conversations", json={"peer_username": ALICE["username"]}, headers=headers)
    assert r.status_code == 400


def test_conversation_nonexistent_peer():
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    r = requests.post(f"{API}/conversations", json={"peer_username": "ghost_xyz_99"}, headers=headers)
    assert r.status_code == 404


def test_list_conversations():
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    r = requests.get(f"{API}/conversations", headers=headers)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list) and len(arr) >= 1
    found = next((c for c in arr if c["conversation_id"] == state["conv_id"]), None)
    assert found is not None
    assert "peer" in found
    assert "last_activity" in found
    assert "last_message" not in found
    assert "name" not in found


# ─── Messages ───────────────────────────────────────────────────────────
def test_send_message():
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    body = {
        "conversation_id": state["conv_id"],
        "ciphertext": "Y2lwaGVydGV4dF9oZXJl",
        "iv": "aXZfYmFzZTY0",
        "encrypted_keys": {
            state["alice_user"]["user_id"]: "QUFBLi4uYmFzZTY0",
            state["bob_user"]["user_id"]: "QkJCLi4uYmFzZTY0",
        },
        "message_type": "text",
        "plaintext_length": 11,
    }
    r = requests.post(f"{API}/messages", json=body, headers=headers)
    assert r.status_code == 200, r.text
    msg = r.json()
    assert msg["sender_id"] == state["alice_user"]["user_id"]
    assert "expires_at" in msg
    state["msg_id"] = msg["message_id"]


def test_list_messages():
    headers = {"Authorization": f"Bearer {state['bob_token']}"}
    r = requests.get(f"{API}/conversations/{state['conv_id']}/messages", headers=headers)
    assert r.status_code == 200
    msgs = r.json()
    assert isinstance(msgs, list) and len(msgs) >= 1
    assert msgs[0]["message_id"] == state["msg_id"]


def test_list_messages_not_participant():
    # register a third user with no participation
    third = {
        "email": f"eve+{SUFFIX}@ssc.dev",
        "password": "EvePass2026!",
        "username": f"evet{SUFFIX[:3]}",
        "public_key": "PK", "encrypted_private_key": "EPK", "pk_salt": "S", "language": "en",
        "captcha_token": "TEST-TOKEN",
    }
    r = requests.post(f"{API}/auth/register", json=third, headers={"X-Forwarded-For": "10.0.0.99"})
    assert r.status_code == 200
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{API}/conversations/{state['conv_id']}/messages", headers=headers)
    assert r.status_code == 404


# ─── Translation ────────────────────────────────────────────────────────
def test_translate():
    cfg = requests.get(f"{API}/config", timeout=10).json()
    if not cfg.get("translation_enabled"):
        pytest.skip("TRANSLATION_ENABLED=false (Engine 1.2 default — no plaintext egress)")
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    payload = {"text": "Bună ziua", "target_language": "en", "source_language": "ro"}
    r = requests.post(f"{API}/translate", json=payload, headers=headers, timeout=15)
    if r.status_code == 403:
        pytest.skip("Server-side translation disabled")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["target_language"] == "en"
    text = (data.get("translated") or "").lower()
    assert text, "Empty translation"
    if data.get("provider") == "none":
        pytest.skip("Translation service unavailable")
    has_english = any(w in text for w in ["hello", "hi", "good", "day", "morning", "greeting"])
    changed = text.strip() != payload["text"].lower().strip()
    assert has_english or changed, f"Expected English translation, got: {text} (provider={data.get('provider')})"


# ─── File upload/download ───────────────────────────────────────────────
def test_file_upload_download():
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    payload = b"SSC test file content ciphertext"
    files = {"file": ("test.enc", io.BytesIO(payload), "application/octet-stream")}
    data = {"encrypted": "true", "original_content_type": "text/plain"}
    r = requests.post(f"{API}/files/upload", files=files, data=data, headers=headers, timeout=20)
    if r.status_code == 503:
        pytest.skip(f"Storage unavailable: {r.text}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "file_id" in body
    assert body.get("encrypted") is True
    file_id = body["file_id"]

    # download via Authorization header (Engine 2.3 — no JWT in URL)
    r2 = requests.get(f"{API}/files/{file_id}", headers=headers, timeout=20)
    assert r2.status_code == 200
    assert r2.content == payload


def test_plaintext_file_upload_rejected():
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    files = {"file": ("test.txt", io.BytesIO(b"plaintext"), "text/plain")}
    r = requests.post(f"{API}/files/upload", files=files, headers=headers, timeout=20)
    assert r.status_code == 400, r.text
    assert "deprecated" in (r.json().get("detail") or "").lower()


# ─── Google OAuth endpoint shape ────────────────────────────────────────
def test_google_session_invalid():
    r = requests.post(f"{API}/auth/google/session", json={"id_token": "totally-fake"})
    assert r.status_code in (401, 501, 502), r.text


# ─── WebSocket ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_websocket_ping_pong_and_typing():
    a_token = state["alice_token"]
    b_token = state["bob_token"]
    conv_id = state["conv_id"]

    a_url = f"{WS_URL}?token={a_token}"
    b_url = f"{WS_URL}?token={b_token}"

    async with websockets.connect(a_url) as a_ws, websockets.connect(b_url) as b_ws:
        # consume "connected" greeting
        for ws in (a_ws, b_ws):
            greet = await asyncio.wait_for(ws.recv(), timeout=5)
            assert json.loads(greet)["type"] == "connected"

        # ping/pong
        await a_ws.send(json.dumps({"type": "ping"}))
        pong = await asyncio.wait_for(a_ws.recv(), timeout=5)
        assert json.loads(pong)["type"] == "pong"

        # typing -> alice sends -> bob receives
        await a_ws.send(json.dumps({"type": "typing", "conversation_id": conv_id}))
        # bob may also receive (broadcast to all participants including sender)
        received = json.loads(await asyncio.wait_for(b_ws.recv(), timeout=5))
        assert received["type"] == "typing"
        assert received["conversation_id"] == conv_id

        # call-offer signaling -> alice -> bob
        await a_ws.send(json.dumps({
            "type": "call-offer", "to": state["bob_user"]["user_id"],
            "sdp": "fake-sdp", "call_id": "c1",
        }))
        # drain any extra messages bob got from earlier; find call-offer
        deadline = time.time() + 5
        got_offer = None
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(b_ws.recv(), timeout=2)
            except asyncio.TimeoutError:
                break
            obj = json.loads(raw)
            if obj.get("type") == "call-offer":
                got_offer = obj
                break
        assert got_offer is not None, "Bob did not receive call-offer"
        assert got_offer.get("from") == state["alice_user"]["user_id"]


# ─── MongoDB TTL index ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_messages_ttl_index():
    from conftest import mongo_client

    db_name = os.environ.get("DB_NAME", "test_database")
    cli = mongo_client()
    db = cli[db_name]
    indexes = await db.messages.index_information()
    cli.close()
    # look for a TTL index on expires_at
    ttl_found = False
    for name, info in indexes.items():
        keys = info.get("key", [])
        if any(k[0] == "expires_at" for k in keys) and "expireAfterSeconds" in info:
            ttl_found = True
            assert info["expireAfterSeconds"] == 0
    assert ttl_found, f"No TTL index on expires_at: {indexes}"


# ─── Panic wipe ─────────────────────────────────────────────────────────
def test_panic_wipe():
    headers = {"Authorization": f"Bearer {state['alice_token']}"}
    r = requests.post(f"{API}/panic-wipe", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["wiped_conversations"] >= 1

    r2 = requests.get(f"{API}/conversations", headers=headers)
    if r2.status_code == 200:
        assert r2.json() == []

    # account + contacts survive — user must sign in again
    r_login = requests.post(
        f"{API}/auth/login",
        json={"email": ALICE["email"], "password": ALICE["password"]},
    )
    assert r_login.status_code == 200, r_login.text
    new_token = r_login.json()["token"]
    r_contacts = requests.get(
        f"{API}/contacts",
        headers={"Authorization": f"Bearer {new_token}"},
    )
    assert r_contacts.status_code == 200
    contact_ids = [c.get("user_id") or c.get("contact_id") for c in r_contacts.json()]
    assert state["bob_user"]["user_id"] in contact_ids
