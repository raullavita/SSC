"""SSC backend iteration 2 tests: 2FA, push, groups, read receipts, rate-limit, /config.

Run after test_ssc_backend.py to keep rate-limit windows clean for those tests.
"""
import os
import json
import time
import uuid
import asyncio
import base64
import pytest
import requests
import websockets
import pyotp

from test_helpers import auth_headers as _auth_headers, make_mutual_contacts

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"

SUFFIX = uuid.uuid4().hex[:4]

# Three users for group tests
CAPTCHA = "TEST-TOKEN"  # backend uses CF test secret 1x000…AA which accepts any non-empty token

USERS = {
    "u1": {
        "email": f"i2u1+{SUFFIX}@ssc.dev",
        "password": "U1Pass2026!",
        "username": f"i2u1{SUFFIX[:3]}",
        "public_key": "PK1", "encrypted_private_key": "EPK1", "pk_salt": "S1",
        "language": "en", "captcha_token": CAPTCHA,
    },
    "u2": {
        "email": f"i2u2+{SUFFIX}@ssc.dev",
        "password": "U2Pass2026!",
        "username": f"i2u2{SUFFIX[:3]}",
        "public_key": "PK2", "encrypted_private_key": "EPK2", "pk_salt": "S2",
        "language": "en", "captcha_token": CAPTCHA,
    },
    "u3": {
        "email": f"i2u3+{SUFFIX}@ssc.dev",
        "password": "U3Pass2026!",
        "username": f"i2u3{SUFFIX[:3]}",
        "public_key": "PK3", "encrypted_private_key": "EPK3", "pk_salt": "S3",
        "language": "en", "captcha_token": CAPTCHA,
    },
}

state = {}


def _register(u, ip=None):
    headers = {"X-Forwarded-For": ip} if ip else {}
    r = requests.post(f"{API}/auth/register", json=u, headers=headers)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    return body["token"], body["user"]


def auth_headers(token):
    return _auth_headers(token)


# ─── Health & config ────────────────────────────────────────────────────
def test_health_iter2():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_config_endpoint():
    r = requests.get(f"{API}/config")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "turnstile_sitekey" in data
    assert "vapid_public_key" in data
    state["vapid_public_key"] = data.get("vapid_public_key") or ""
    state["turnstile_sitekey"] = data.get("turnstile_sitekey") or ""


# ─── Register 3 users (before rate-limit tests!) ─────────────────────────
def test_register_three_users():
    # Use distinct X-Forwarded-For IPs to avoid the per-IP register rate-limit (5/hr)
    for idx, (key, u) in enumerate(USERS.items()):
        token, user = _register(u, ip=f"10.1.0.{10+idx}")
        state[f"{key}_token"] = token
        state[f"{key}_user"] = user


# ─── Mutual contacts (required before conversations) ───────────────────────
def test_establish_group_contacts():
    u1, u2, u3 = USERS["u1"], USERS["u2"], USERS["u3"]
    make_mutual_contacts(API, state["u1_token"], state["u2_token"], u2["username"])
    make_mutual_contacts(API, state["u1_token"], state["u3_token"], u3["username"])


# ─── Turnstile shape: test secret 1x000…AA always passes for any token ──
def test_turnstile_accepts_any_token():
    """With CF test secret, any non-empty captcha_token is accepted by /siteverify."""
    payload = {
        "email": f"tcap+{SUFFIX}@ssc.dev",
        "password": "TPass2026!",
        "username": f"tcap{SUFFIX[:3]}",
        "public_key": "PK", "encrypted_private_key": "EPK", "pk_salt": "S",
        "language": "en",
        "captcha_token": "ANY-FAKE-TOKEN-VALUE",
    }
    r = requests.post(f"{API}/auth/register", json=payload, headers={"X-Forwarded-For": "10.2.0.50"})
    assert r.status_code in (200, 409), r.text


# ─── 2FA flow ────────────────────────────────────────────────────────────
def test_2fa_setup_and_verify_and_login():
    token = state["u1_token"]
    # setup
    r = requests.post(f"{API}/auth/2fa/setup", headers=auth_headers(token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert "secret" in data and "otpauth_url" in data
    secret = data["secret"]
    # base32 chars only
    assert all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" for c in secret), secret
    state["u1_totp_secret"] = secret
    assert "otpauth://" in data["otpauth_url"]

    # verify
    code = pyotp.TOTP(secret).now()
    r = requests.post(f"{API}/auth/2fa/verify", json={"code": code}, headers=auth_headers(token))
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    # GET /auth/me shows totp_enabled
    r = requests.get(f"{API}/auth/me", headers=auth_headers(token))
    assert r.status_code == 200
    me = r.json()
    assert me.get("totp_enabled") is True
    # secret should NOT leak
    assert "totp_secret" not in me
    assert "totp_pending_secret" not in me


def test_2fa_login_without_code_returns_401_with_header():
    u = USERS["u1"]
    r = requests.post(f"{API}/auth/login", json={"email": u["email"], "password": u["password"]})
    assert r.status_code == 401, r.text
    body = r.json()
    detail = (body.get("detail") or "").lower()
    assert "2fa" in detail or "code" in detail, body
    # Header tells client to prompt for TOTP
    assert r.headers.get("X-Requires-2FA") == "1", dict(r.headers)


def test_2fa_login_with_wrong_code_returns_401():
    u = USERS["u1"]
    r = requests.post(
        f"{API}/auth/login",
        json={"email": u["email"], "password": u["password"], "totp_code": "000000"},
    )
    assert r.status_code == 401, r.text


def test_2fa_login_with_correct_code_succeeds():
    u = USERS["u1"]
    code = pyotp.TOTP(state["u1_totp_secret"]).now()
    r = requests.post(
        f"{API}/auth/login",
        json={"email": u["email"], "password": u["password"], "totp_code": code},
    )
    assert r.status_code == 200, r.text
    assert "token" in r.json()
    # refresh stored token
    state["u1_token"] = r.json()["token"]


def test_no_totp_secret_leak_anywhere():
    """CRITICAL fix verification: totp_secret and totp_pending_secret must not appear
    in any user-bearing response while u1 has 2FA enabled."""
    forbidden = {"totp_secret", "totp_pending_secret"}

    def _assert_clean(obj, where):
        if isinstance(obj, dict):
            leaked = forbidden & set(obj.keys())
            assert not leaked, f"LEAK at {where}: {leaked} in {list(obj.keys())}"
            for k, v in obj.items():
                _assert_clean(v, f"{where}.{k}")
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                _assert_clean(item, f"{where}[{i}]")

    token = state["u1_token"]

    # 1) /auth/me
    r = requests.get(f"{API}/auth/me", headers=auth_headers(token))
    assert r.status_code == 200, r.text
    me = r.json()
    assert me.get("totp_enabled") is True, "precondition: u1 must have 2FA enabled"
    _assert_clean(me, "/auth/me")

    # 2) /auth/login response.user (with correct TOTP code, fresh login)
    u = USERS["u1"]
    code = pyotp.TOTP(state["u1_totp_secret"]).now()
    r2 = requests.post(
        f"{API}/auth/login",
        json={"email": u["email"], "password": u["password"], "totp_code": code},
    )
    assert r2.status_code == 200, r2.text
    login_body = r2.json()
    assert "user" in login_body
    _assert_clean(login_body["user"], "/auth/login.user")
    _assert_clean(login_body, "/auth/login")
    # refresh token to avoid invalidation issues from prior login
    state["u1_token"] = login_body["token"]
    token = state["u1_token"]

    # 3) /users/search
    q = USERS["u2"]["username"][:3]
    r3 = requests.get(f"{API}/users/search", params={"q": q}, headers=auth_headers(token))
    assert r3.status_code == 200, r3.text
    results = r3.json()
    assert isinstance(results, list)
    _assert_clean(results, "/users/search")

    # 4) POST /conversations group response (participants is list of ids, but check whole body)
    body = {
        "is_group": True,
        "peer_usernames": [USERS["u2"]["username"], USERS["u3"]["username"]],
        "name": "Leak check group",
    }
    r4 = requests.post(f"{API}/conversations", json=body, headers=auth_headers(token))
    assert r4.status_code == 200, r4.text
    _assert_clean(r4.json(), "POST /conversations(group)")

    # 4b) GET /conversations list also returns members dicts
    r4b = requests.get(f"{API}/conversations", headers=auth_headers(token))
    assert r4b.status_code == 200
    _assert_clean(r4b.json(), "GET /conversations")

    # 5) GET /users/{user_id}/public (u2's id)
    u2_id = state["u2_user"]["user_id"]
    r5 = requests.get(f"{API}/users/{u2_id}/public", headers=auth_headers(token))
    assert r5.status_code == 200, r5.text
    _assert_clean(r5.json(), f"/users/{u2_id}/public")

    # 6) GET self public too (u1 has 2FA enabled — strongest test)
    u1_id = state["u1_user"]["user_id"]
    r6 = requests.get(f"{API}/users/{u1_id}/public", headers=auth_headers(token))
    assert r6.status_code == 200, r6.text
    _assert_clean(r6.json(), f"/users/{u1_id}/public (self, 2FA on)")


def test_2fa_disable():
    token = state["u1_token"]
    code = pyotp.TOTP(state["u1_totp_secret"]).now()
    r = requests.post(
        f"{API}/auth/2fa/disable",
        json={"code": code, "password": USERS["u1"]["password"]},
        headers=auth_headers(token),
    )
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    # confirm via /me
    r2 = requests.get(f"{API}/auth/me", headers=auth_headers(token))
    assert r2.status_code == 200
    assert r2.json().get("totp_enabled") is False


# ─── Push subscriptions ─────────────────────────────────────────────────
def test_push_public_key_matches_config():
    if not state.get("vapid_public_key"):
        pytest.skip("VAPID not configured on server")
    r = requests.get(f"{API}/push/public-key")
    assert r.status_code == 200
    data = r.json()
    assert data.get("vapid_public_key") == state["vapid_public_key"]


def test_push_subscribe_and_unsubscribe():
    token = state["u1_token"]
    endpoint = f"https://example.push/test-{SUFFIX}-{uuid.uuid4().hex[:8]}"
    body = {
        "endpoint": endpoint,
        "keys": {
            "p256dh": base64.urlsafe_b64encode(b"x" * 65).decode().rstrip("="),
            "auth": base64.urlsafe_b64encode(b"y" * 16).decode().rstrip("="),
        },
    }
    r = requests.post(f"{API}/push/subscribe", json=body, headers=auth_headers(token))
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    # unsubscribe
    r2 = requests.post(f"{API}/push/unsubscribe", json=body, headers=auth_headers(token))
    assert r2.status_code == 200, r2.text
    assert r2.json().get("ok") is True


# ─── Group conversation ─────────────────────────────────────────────────
def test_group_create_unknown_user_returns_404():
    token = state["u1_token"]
    r = requests.post(
        f"{API}/conversations",
        json={"is_group": True, "peer_usernames": ["ghost_no_one_x"], "name": "Bad"},
        headers=auth_headers(token),
    )
    assert r.status_code == 404, r.text
    assert "unknown" in r.text.lower()


def test_group_needs_at_least_3_total_members():
    token = state["u1_token"]
    r = requests.post(
        f"{API}/conversations",
        json={"is_group": True, "peer_usernames": [USERS["u2"]["username"]], "name": "Tiny"},
        headers=auth_headers(token),
    )
    assert r.status_code == 400, r.text


def test_group_create_success():
    token = state["u1_token"]
    r = requests.post(
        f"{API}/conversations",
        json={
            "is_group": True,
            "peer_usernames": [USERS["u2"]["username"], USERS["u3"]["username"]],
            "name": "Test group",
        },
        headers=auth_headers(token),
    )
    assert r.status_code == 200, r.text
    conv = r.json()
    assert conv.get("is_group") is True
    assert conv.get("display_label") == "Group (3)"
    assert "name" not in conv
    assert conv["conversation_id"].startswith("g_")
    parts = conv["participants"]
    assert isinstance(parts, list) and len(parts) == 3
    assert parts == sorted(parts), "participants should be sorted"
    assert state["u1_user"]["user_id"] in parts
    assert state["u2_user"]["user_id"] in parts
    assert state["u3_user"]["user_id"] in parts
    state["group_id"] = conv["conversation_id"]


def test_create_1on1_for_listing():
    token = state["u1_token"]
    r = requests.post(
        f"{API}/conversations",
        json={"peer_username": USERS["u2"]["username"]},
        headers=auth_headers(token),
    )
    assert r.status_code == 200, r.text
    conv = r.json()
    assert conv["conversation_id"].startswith("c_")
    state["dm_id"] = conv["conversation_id"]


def test_list_conversations_has_both():
    token = state["u1_token"]
    r = requests.get(f"{API}/conversations", headers=auth_headers(token))
    assert r.status_code == 200
    arr = r.json()
    by_id = {c["conversation_id"]: c for c in arr}
    assert state["group_id"] in by_id
    assert state["dm_id"] in by_id

    g = by_id[state["group_id"]]
    assert g.get("is_group") is True
    assert g.get("display_label") == "Group (3)"
    assert "name" not in g
    assert "last_activity" in g
    assert "last_message" not in g
    assert g.get("peer") is None
    assert isinstance(g.get("members"), list) and len(g["members"]) == 2
    # member dicts shaped like public user
    for m in g["members"]:
        assert "user_id" in m and "username" in m

    d = by_id[state["dm_id"]]
    assert not d.get("is_group")
    assert d.get("peer") is not None
    assert d["peer"]["user_id"] == state["u2_user"]["user_id"]


def test_send_group_message_with_multi_keys():
    token = state["u1_token"]
    body = {
        "conversation_id": state["group_id"],
        "ciphertext": base64.b64encode(b"ciphertext-for-group").decode(),
        "iv": base64.b64encode(b"iv-bytes-here-12").decode(),
        "encrypted_keys": {
            state["u1_user"]["user_id"]: base64.b64encode(b"k1").decode(),
            state["u2_user"]["user_id"]: base64.b64encode(b"k2").decode(),
            state["u3_user"]["user_id"]: base64.b64encode(b"k3").decode(),
        },
        "message_type": "text",
        "plaintext_length": 20,
    }
    r = requests.post(f"{API}/messages", json=body, headers=auth_headers(token))
    assert r.status_code == 200, r.text
    msg = r.json()
    assert msg["sender_id"] == state["u1_user"]["user_id"]
    state["group_msg_id"] = msg["message_id"]

    # list messages as u2
    r2 = requests.get(
        f"{API}/conversations/{state['group_id']}/messages",
        headers=auth_headers(state["u2_token"]),
    )
    assert r2.status_code == 200
    msgs = r2.json()
    assert any(m["message_id"] == state["group_msg_id"] for m in msgs)


# ─── Read receipts ──────────────────────────────────────────────────────
def test_read_receipts_explicit_and_get():
    # u2 sends a message in the DM (u1↔u2)
    body = {
        "conversation_id": state["dm_id"],
        "ciphertext": base64.b64encode(b"hello-from-u2").decode(),
        "iv": base64.b64encode(b"iv2-bytes-12345").decode(),
        "encrypted_keys": {
            state["u1_user"]["user_id"]: base64.b64encode(b"k1").decode(),
            state["u2_user"]["user_id"]: base64.b64encode(b"k2").decode(),
        },
        "message_type": "text",
        "plaintext_length": 13,
    }
    r = requests.post(f"{API}/messages", json=body, headers=auth_headers(state["u2_token"]))
    assert r.status_code == 200, r.text
    msg_id = r.json()["message_id"]
    state["dm_msg_id"] = msg_id

    # u1 marks read up to that message_id
    r2 = requests.post(
        f"{API}/messages/read",
        json={"conversation_id": state["dm_id"], "up_to_message_id": msg_id},
        headers=auth_headers(state["u1_token"]),
    )
    assert r2.status_code == 200, r2.text
    assert r2.json().get("ok") is True

    # GET reads
    r3 = requests.get(
        f"{API}/conversations/{state['dm_id']}/reads",
        headers=auth_headers(state["u1_token"]),
    )
    assert r3.status_code == 200, r3.text
    reads = r3.json()
    assert isinstance(reads, list)
    me_read = next((x for x in reads if x.get("user_id") == state["u1_user"]["user_id"]), None)
    assert me_read is not None, reads
    assert me_read.get("last_read_message_id") == msg_id
    assert "last_read_at" in me_read


def test_read_receipts_implicit_latest():
    # u2 sends another message
    body = {
        "conversation_id": state["dm_id"],
        "ciphertext": base64.b64encode(b"second-msg").decode(),
        "iv": base64.b64encode(b"iv2-bytes-12345").decode(),
        "encrypted_keys": {
            state["u1_user"]["user_id"]: base64.b64encode(b"k1").decode(),
            state["u2_user"]["user_id"]: base64.b64encode(b"k2").decode(),
        },
        "message_type": "text",
        "plaintext_length": 10,
    }
    r = requests.post(f"{API}/messages", json=body, headers=auth_headers(state["u2_token"]))
    assert r.status_code == 200
    latest_id = r.json()["message_id"]

    # u1 marks read WITHOUT up_to_message_id
    r2 = requests.post(
        f"{API}/messages/read",
        json={"conversation_id": state["dm_id"]},
        headers=auth_headers(state["u1_token"]),
    )
    assert r2.status_code == 200, r2.text

    r3 = requests.get(
        f"{API}/conversations/{state['dm_id']}/reads",
        headers=auth_headers(state["u1_token"]),
    )
    reads = r3.json()
    me_read = next((x for x in reads if x.get("user_id") == state["u1_user"]["user_id"]), None)
    assert me_read.get("last_read_message_id") == latest_id


# ─── WebSocket read broadcast ───────────────────────────────────────────
@pytest.mark.asyncio
async def test_ws_forwards_read_receipt():
    u1_token = state["u1_token"]
    u2_token = state["u2_token"]
    dm_id = state["dm_id"]

    async with websockets.connect(f"{WS_URL}?token={u1_token}") as u1_ws, \
               websockets.connect(f"{WS_URL}?token={u2_token}") as u2_ws:
        # drain "connected" greeting
        for ws in (u1_ws, u2_ws):
            greet = await asyncio.wait_for(ws.recv(), timeout=5)
            assert json.loads(greet)["type"] == "connected"

        # u2 sends a new message via HTTP API (so WS broadcasts to u1 too — drain)
        body = {
            "conversation_id": dm_id,
            "ciphertext": base64.b64encode(b"ws-test").decode(),
            "iv": base64.b64encode(b"iv-12345-bytes-x").decode(),
            "encrypted_keys": {
                state["u1_user"]["user_id"]: base64.b64encode(b"k1").decode(),
                state["u2_user"]["user_id"]: base64.b64encode(b"k2").decode(),
            },
            "message_type": "text",
            "plaintext_length": 7,
        }
        send = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: requests.post(f"{API}/messages", json=body, headers=auth_headers(u2_token)),
        )
        assert send.status_code == 200
        new_msg_id = send.json()["message_id"]

        # drain any pending ws messages for both
        async def drain(ws, deadline_s=1.0):
            deadline = time.time() + deadline_s
            while time.time() < deadline:
                try:
                    await asyncio.wait_for(ws.recv(), timeout=0.4)
                except asyncio.TimeoutError:
                    return
        await asyncio.gather(drain(u1_ws), drain(u2_ws))

        # u1 marks read via HTTP — u2 should receive a "read" event over WS
        read_resp = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: requests.post(
                f"{API}/messages/read",
                json={"conversation_id": dm_id, "up_to_message_id": new_msg_id},
                headers=auth_headers(u1_token),
            ),
        )
        assert read_resp.status_code == 200

        # wait for read event on u2
        deadline = time.time() + 5
        got_read = None
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(u2_ws.recv(), timeout=2)
            except asyncio.TimeoutError:
                break
            obj = json.loads(raw)
            if obj.get("type") == "read":
                got_read = obj
                break
        assert got_read is not None, "u2 did not receive 'read' event"
        assert got_read.get("conversation_id") == dm_id
        assert got_read.get("user_id") == state["u1_user"]["user_id"]
        assert got_read.get("last_read_message_id") == new_msg_id


# ─── Rate limiting (run last in module) ─────────────────────────────────
def test_zz_rate_limit_register():
    """6 rapid registrations from this IP → 6th yields 429.

    NOTE: rate-limit bucket is per-IP and per-worker, in-memory. Previous
    registration tests already consumed some hits in this process. So we
    expect a 429 within the next 6 attempts.
    """
    saw_429 = False
    rl_ip = "99.99.99.99"  # dedicated IP so iter1/iter2 setup registrations don't pollute this bucket
    for i in range(6):
        payload = {
            "email": f"rl+{SUFFIX}+{i}+{uuid.uuid4().hex[:4]}@ssc.dev",
            "password": "RlPass2026!",
            "username": f"rl{SUFFIX[:2]}{i}{uuid.uuid4().hex[:2]}",
            "public_key": "PK", "encrypted_private_key": "EPK", "pk_salt": "S",
            "language": "en", "captcha_token": CAPTCHA,
        }
        r = requests.post(f"{API}/auth/register", json=payload, headers={"X-Forwarded-For": rl_ip})
        if r.status_code == 429:
            saw_429 = True
            break
    assert saw_429, "Expected at least one 429 in 6 rapid registrations"


def test_zz_rate_limit_login():
    """11 rapid login attempts → at least one 429.

    Uses wrong credentials to avoid creating sessions / and to trigger
    login route fully (rate-limit check happens before credential check).
    """
    saw_429 = False
    rl_ip = "99.99.99.100"
    for i in range(11):
        r = requests.post(
            f"{API}/auth/login",
            json={"email": f"nobody+{i}@ssc.dev", "password": "x"},
            headers={"X-Forwarded-For": rl_ip},
        )
        if r.status_code == 429:
            saw_429 = True
            break
    assert saw_429, "Expected at least one 429 in 11 rapid logins"
