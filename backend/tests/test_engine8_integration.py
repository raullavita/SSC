"""Engine 8 Step 8.8 — live-server Signal Protocol integration (requires backend on :8000)."""
from __future__ import annotations

import asyncio
import base64
import json
import os
import time
import uuid

import pytest
import requests
import websockets

from core.signal_policy import LIBSIGNAL_PINNED_VERSION, ProtocolVersion
from test_helpers import auth_headers, make_mutual_contacts, ws_connect_url

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
SUFFIX = uuid.uuid4().hex[:4]

_VALID_SIGNAL_CT = base64.b64encode(b"x" * 32).decode("ascii")


def _server_up() -> bool:
    try:
        r = requests.get(f"{API}/", timeout=3)
        return r.status_code == 200 and r.json().get("status") == "ok"
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _server_up(), reason="backend not running on :8000")

state: dict = {}


def _key_b64() -> str:
    return base64.b64encode(b"\x05" + b"k" * 32).decode()


def _sig_b64() -> str:
    return base64.b64encode(b"s" * 64).decode()


def _kyber_b64() -> str:
    return base64.b64encode(b"\x08" + b"k" * 200).decode()


def _prekey_payload(one_time_id: int = 10) -> dict:
    return {
        "registration_id": 12000 + int(SUFFIX, 16) % 1000,
        "device_id": 1,
        "identity_key_public": _key_b64(),
        "signed_prekey_id": 1,
        "signed_prekey_public": _key_b64(),
        "signed_prekey_signature": _sig_b64(),
        "kyber_prekey_id": 1,
        "kyber_prekey_public": _kyber_b64(),
        "kyber_prekey_signature": _sig_b64(),
        "one_time_prekeys": [{"prekey_id": one_time_id, "public": _key_b64()}],
        "libsignal_version": LIBSIGNAL_PINNED_VERSION,
    }


def _reg_headers() -> dict:
    return {"X-Forwarded-For": f"10.88.0.{int(SUFFIX, 16) % 200 + 1}"}


def test_engine8_register_users():
    for tag in ("a", "b"):
        payload = {
            "email": f"sig8.{tag}.{SUFFIX}@ssc.dev",
            "password": "Sig8Pass2026!",
            "username": f"s8{tag}{SUFFIX[:3]}",
            "public_key": f"PK8_{tag}",
            "encrypted_private_key": f"EPK8_{tag}",
            "pk_salt": f"S8_{tag}",
            "language": "en",
            "captcha_token": "TEST-TOKEN",
        }
        r = requests.post(f"{API}/auth/register", json=payload, headers=_reg_headers(), timeout=15)
        assert r.status_code == 200, r.text
        state[f"{tag}_token"] = r.json()["token"]
        state[f"{tag}_user"] = r.json()["user"]


def test_engine8_mutual_contacts():
    make_mutual_contacts(
        API,
        state["a_token"],
        state["b_token"],
        state["b_user"]["username"],
    )


def test_engine8_config_exposes_signal():
    r = requests.get(f"{API}/config", timeout=10)
    assert r.status_code == 200, r.text
    signal = r.json().get("signal", {})
    assert signal.get("pinned_version") == LIBSIGNAL_PINNED_VERSION
    assert signal.get("prekey_api") is True


def test_engine8_prekey_bundle_roundtrip():
    for tag in ("a", "b"):
        r = requests.put(
            f"{API}/keys/prekey-bundle",
            json=_prekey_payload(10 + ord(tag)),
            headers=auth_headers(state[f"{tag}_token"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "ok"

    me = requests.get(
        f"{API}/keys/prekey-bundle/me",
        headers=auth_headers(state["a_token"]),
        timeout=15,
    )
    assert me.status_code == 200, me.text
    assert me.json().get("ready") is True

    peer_id = state["b_user"]["user_id"]
    r = requests.get(
        f"{API}/keys/prekey-bundle/{peer_id}",
        headers=auth_headers(state["a_token"]),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("user_id") == peer_id
    assert body.get("identity_key_public")
    assert body.get("one_time_prekeys")
    assert body.get("kyber_prekey_public")


def test_engine8_conversation_for_messaging():
    r = requests.post(
        f"{API}/conversations",
        json={"peer_username": state["b_user"]["username"]},
        headers=auth_headers(state["a_token"]),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    state["conv_id"] = r.json()["conversation_id"]


def test_engine8_signal_v1_message_accepted():
    msg = {
        "conversation_id": state["conv_id"],
        "protocol": ProtocolVersion.SIGNAL_V1.value,
        "ciphertext": _VALID_SIGNAL_CT,
        "signal_message_type": 2,
        "message_type": "text",
    }
    r = requests.post(f"{API}/messages", json=msg, headers=auth_headers(state["a_token"]), timeout=15)
    assert r.status_code == 200, r.text
    sent = r.json()
    assert sent.get("protocol") == ProtocolVersion.SIGNAL_V1.value
    assert sent.get("signal_message_type") == 2
    assert "iv" not in sent or sent.get("iv") is None
    assert not sent.get("encrypted_keys")

    r2 = requests.get(
        f"{API}/conversations/{state['conv_id']}/messages",
        headers=auth_headers(state["b_token"]),
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    rows = r2.json()
    assert rows
    peer_view = rows[-1]
    assert peer_view.get("protocol") == ProtocolVersion.SIGNAL_V1.value
    assert peer_view.get("ciphertext") == _VALID_SIGNAL_CT


def test_engine8_legacy_message_protocol_normalized():
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
    r = requests.post(f"{API}/messages", json=msg, headers=auth_headers(state["a_token"]), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("protocol") == ProtocolVersion.LEGACY_RSA.value

    r2 = requests.get(
        f"{API}/conversations/{state['conv_id']}/messages",
        headers=auth_headers(state["b_token"]),
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    legacy_rows = [m for m in r2.json() if m.get("iv")]
    assert legacy_rows
    assert legacy_rows[-1].get("protocol") == ProtocolVersion.LEGACY_RSA.value


@pytest.mark.asyncio
async def test_engine8_ws_legacy_call_offer_relay():
    a_url = ws_connect_url(API, WS_BASE, state["a_token"])
    b_url = ws_connect_url(API, WS_BASE, state["b_token"])
    bob_id = state["b_user"]["user_id"]

    async with websockets.connect(a_url) as a_ws, websockets.connect(b_url) as b_ws:
        for ws in (a_ws, b_ws):
            greet = await asyncio.wait_for(ws.recv(), timeout=5)
            assert json.loads(greet)["type"] == "connected"

        await a_ws.send(json.dumps({
            "type": "call-offer",
            "to": bob_id,
            "mode": "audio",
            "sdp": {"type": "offer", "sdp": "v=0"},
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

        assert got is not None, "legacy call-offer not relayed"
        assert got.get("from") == state["a_user"]["user_id"]
        assert got.get("sdp", {}).get("type") == "offer"


@pytest.mark.asyncio
async def test_engine8_ws_signal_v1_call_offer_opaque_relay():
    a_url = ws_connect_url(API, WS_BASE, state["a_token"])
    b_url = ws_connect_url(API, WS_BASE, state["b_token"])
    bob_id = state["b_user"]["user_id"]

    async with websockets.connect(a_url) as a_ws, websockets.connect(b_url) as b_ws:
        for ws in (a_ws, b_ws):
            greet = await asyncio.wait_for(ws.recv(), timeout=5)
            assert json.loads(greet)["type"] == "connected"

        await a_ws.send(json.dumps({
            "type": "call-offer",
            "to": bob_id,
            "mode": "video",
            "signaling_protocol": "signal_v1",
            "signaling_ciphertext": _VALID_SIGNAL_CT,
            "signal_message_type": 2,
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

        assert got is not None, "signal_v1 call-offer not relayed"
        assert got.get("signaling_protocol") == "signal_v1"
        assert got.get("signaling_ciphertext") == _VALID_SIGNAL_CT
        assert not got.get("sdp")


@pytest.mark.asyncio
async def test_engine8_ws_signal_v1_cleartext_leak_rejected():
    a_url = ws_connect_url(API, WS_BASE, state["a_token"])
    b_url = ws_connect_url(API, WS_BASE, state["b_token"])
    bob_id = state["b_user"]["user_id"]

    async with websockets.connect(a_url) as a_ws, websockets.connect(b_url) as b_ws:
        for ws in (a_ws, b_ws):
            greet = await asyncio.wait_for(ws.recv(), timeout=5)
            assert json.loads(greet)["type"] == "connected"

        await a_ws.send(json.dumps({
            "type": "call-offer",
            "to": bob_id,
            "signaling_protocol": "signal_v1",
            "signaling_ciphertext": _VALID_SIGNAL_CT,
            "signal_message_type": 2,
            "sdp": {"type": "offer", "sdp": "leaked"},
        }))

        deadline = time.time() + 3
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(b_ws.recv(), timeout=1)
            except asyncio.TimeoutError:
                break
            obj = json.loads(raw)
            assert obj.get("type") != "call-offer", "leaky signal_v1 offer must not be relayed"


def test_engine8_upload_and_send_attachment():
    headers = auth_headers(state["a_token"])

    # 1. Upload an encrypted file
    files = {"file": ("test.txt.enc", b"encryptedfilecontent", "application/octet-stream")}
    data = {"encrypted": "true", "original_content_type": "text/plain"}
    r = requests.post(f"{API}/files/upload", files=files, data=data, headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    file_id = r.json()["file_id"]
    assert file_id

    # 2. Send message with the file as an attachment
    msg = {
        "conversation_id": state["conv_id"],
        "protocol": ProtocolVersion.SIGNAL_V1.value,
        "ciphertext": _VALID_SIGNAL_CT,
        "signal_message_type": 2,
        "message_type": "file",
        "attachment_id": file_id,
        "attachment_content_type": "text/plain",
    }
    r = requests.post(f"{API}/messages", json=msg, headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    sent = r.json()
    assert sent.get("attachment_id") == file_id
    assert sent.get("attachment_content_type") == "text/plain"

    # 3. Peer retrieves messages and verifies it has the attachment
    r2 = requests.get(
        f"{API}/conversations/{state['conv_id']}/messages",
        headers=auth_headers(state["b_token"]),
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    rows = r2.json()
    assert rows
    msg_with_attach = [m for m in rows if m.get("attachment_id") == file_id]
    assert len(msg_with_attach) == 1
    assert msg_with_attach[0]["attachment_content_type"] == "text/plain"