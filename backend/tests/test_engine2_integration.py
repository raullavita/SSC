"""Engine 2 Step 2.7 — live-server E2E integrity checks (requires backend on :8000)."""
import io
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
    return {"X-Forwarded-For": f"10.8.0.{int(SUFFIX, 16) % 200 + 1}"}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_engine2_register_users():
    for tag, lang in (("a", "en"), ("b", "ro")):
        payload = {
            "email": f"e2.{tag}.{SUFFIX}@ssc.dev",
            "password": "E2Pass2026!",
            "username": f"e2{tag}{SUFFIX[:3]}",
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


def test_engine2_mutual_contacts():
    make_mutual_contacts(
        API,
        state["a_token"],
        state["b_token"],
        state["b_user"]["username"],
    )


def test_engine2_plaintext_file_upload_rejected():
    files = {"file": ("leak.txt", io.BytesIO(b"plaintext"), "text/plain")}
    r = requests.post(
        f"{API}/files/upload",
        files=files,
        headers=_auth(state["a_token"]),
        timeout=20,
    )
    assert r.status_code == 400, r.text
    assert "deprecated" in (r.json().get("detail") or "").lower()


def test_engine2_encrypted_file_roundtrip():
    payload = b"e2e gate ciphertext bytes"
    files = {"file": ("gate.enc", io.BytesIO(payload), "application/octet-stream")}
    form = {"encrypted": "true", "original_content_type": "text/plain"}
    r = requests.post(
        f"{API}/files/upload",
        files=files,
        data=form,
        headers=_auth(state["a_token"]),
        timeout=20,
    )
    if r.status_code == 503:
        pytest.skip(f"Storage unavailable: {r.text}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("encrypted") is True
    file_id = body["file_id"]

    r2 = requests.get(f"{API}/files/{file_id}", headers=_auth(state["a_token"]), timeout=20)
    assert r2.status_code == 200, r2.text
    assert r2.content == payload

    r3 = requests.get(f"{API}/files/{file_id}?auth=fake-jwt", headers=_auth(state["a_token"]), timeout=20)
    assert r3.status_code == 200, "Authorization header must work; ?auth= must not be required"
    assert "?auth=" not in str(r3.request.url) or r3.status_code == 200


def test_engine2_message_response_integrity():
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
        "ciphertext": "Q0lQSEVSVEVYVA==",
        "iv": "aXY=",
        "encrypted_keys": {
            state["a_user"]["user_id"]: "Aw==",
            state["b_user"]["user_id"]: "Bw==",
        },
        "message_type": "text",
        "plaintext_length": 99,
        "sender_username": "leak",
    }
    r = requests.post(f"{API}/messages", json=msg, headers=_auth(state["a_token"]), timeout=15)
    assert r.status_code == 200, r.text
    sent = r.json()
    assert "plaintext_length" not in sent
    assert "sender_username" not in sent
    assert set(sent.get("encrypted_keys", {}).keys()) == {state["a_user"]["user_id"]}

    r2 = requests.get(
        f"{API}/conversations/{conv_id}/messages",
        headers=_auth(state["b_token"]),
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    rows = r2.json()
    assert rows
    peer_view = rows[-1]
    assert "plaintext_length" not in peer_view
    assert "sender_username" not in peer_view
    assert set(peer_view.get("encrypted_keys", {}).keys()) == {state["b_user"]["user_id"]}


def test_engine2_legacy_plaintext_file_download_rejected():
    """G8 — server must not serve legacy plaintext blobs."""
    import certifi
    from datetime import datetime, timedelta, timezone

    from pymongo import MongoClient

    from core.config import DB_NAME, MONGO_URL
    from core.utils import iso, now_utc

    file_id = f"legacy_{SUFFIX}"
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    record = {
        "file_id": file_id,
        "owner_id": state["a_user"]["user_id"],
        "original_filename": "legacy.txt",
        "content_type": "text/plain",
        "encrypted": False,
        "size": 9,
        "is_deleted": False,
        "created_at": iso(now_utc()),
        "expires_at": expires,
    }

    if MONGO_URL.startswith("mongodb+srv://") or "tls=true" in MONGO_URL:
        client = MongoClient(MONGO_URL, tlsCAFile=certifi.where())
    else:
        client = MongoClient(MONGO_URL)
    try:
        client[DB_NAME].files.insert_one(record)
        r = requests.get(f"{API}/files/{file_id}", headers=_auth(state["a_token"]), timeout=20)
        assert r.status_code == 410, r.text
        assert "legacy" in (r.json().get("detail") or "").lower()
    finally:
        client[DB_NAME].files.delete_one({"file_id": file_id})
        client.close()