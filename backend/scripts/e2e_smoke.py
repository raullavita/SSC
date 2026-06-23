"""
API-level E2E smoke test (no browser). Run:
  venv\\Scripts\\python.exe scripts\\e2e_smoke.py
Requires backend on http://127.0.0.1:8000
"""
import io
import os
import sys
import uuid
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE}/api"
SUFFIX = uuid.uuid4().hex[:6]
IP = f"10.9.0.{int(SUFFIX[:2], 16) % 200 + 1}"


def ok(label: str):
    print(f"  OK  {label}")


def step(label: str):
    print(f"\n== {label} ==")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Forwarded-For": IP}


def register_user(tag: str):
    payload = {
        "email": f"e2e.{tag}.{SUFFIX}@ssc.dev",
        "password": "E2ePass2026!",
        "username": f"e2e{tag}{SUFFIX[:4]}",
        "public_key": f"PK_{tag}",
        "encrypted_private_key": f"EPK_{tag}",
        "pk_salt": f"S_{tag}",
        "language": "en",
        "captcha_token": "TEST-TOKEN",
    }
    r = requests.post(f"{API}/auth/register", json=payload, headers={"X-Forwarded-For": IP}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    return body["token"], body["user"], payload


def make_contacts(token_a, token_b, username_b):
    r = requests.post(f"{API}/contacts/request", json={"username": username_b}, headers=auth(token_a), timeout=15)
    assert r.status_code == 200, r.text
    r2 = requests.get(f"{API}/contacts/requests", headers=auth(token_b), timeout=15)
    assert r2.status_code == 200 and r2.json(), r2.text
    req_id = r2.json()[-1]["request_id"]
    r3 = requests.post(f"{API}/contacts/requests/accept", json={"request_id": req_id}, headers=auth(token_b), timeout=15)
    assert r3.status_code == 200, r3.text


def main():
    print(f"E2E smoke -> {API}")

    step("Health")
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200 and r.json().get("status") == "ok"
    ok("health")

    step("Register two users")
    token_a, user_a, spec_a = register_user("a")
    token_b, user_b, _ = register_user("b")
    ok(f"users {spec_a['username']} + {user_b['username']}")

    step("Mutual contacts")
    make_contacts(token_a, token_b, user_b["username"])
    ok("contacts")

    step("Create conversation + send message")
    r = requests.post(
        f"{API}/conversations",
        json={"peer_username": user_b["username"]},
        headers=auth(token_a),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    conv_id = r.json()["conversation_id"]
    msg_body = {
        "conversation_id": conv_id,
        "ciphertext": "Y2lwaGVydGV4dA==",
        "iv": "aXY=",
        "encrypted_keys": {user_a["user_id"]: "Aw==", user_b["user_id"]: "Bw=="},
        "message_type": "text",
        "plaintext_length": 4,
    }
    r = requests.post(f"{API}/messages", json=msg_body, headers=auth(token_a), timeout=15)
    assert r.status_code == 200, r.text
    msg_id = r.json()["message_id"]
    ok(f"message {msg_id}")

    step("E2E file upload + message attach + peer download")
    cipher = b"e2e smoke file ciphertext"
    files = {"file": ("smoke.enc", io.BytesIO(cipher), "application/octet-stream")}
    form = {"encrypted": "true", "original_content_type": "text/plain"}
    r = requests.post(f"{API}/files/upload", files=files, data=form, headers=auth(token_a), timeout=20)
    if r.status_code == 503:
        print("  SKIP storage unavailable")
    else:
        assert r.status_code == 200, r.text
        file_id = r.json()["file_id"]
        attach_msg = {
            "conversation_id": conv_id,
            "ciphertext": "ZmlsZQ==",
            "iv": "aXY=",
            "encrypted_keys": {user_a["user_id"]: "Aw==", user_b["user_id"]: "Bw=="},
            "message_type": "file",
            "attachment_id": file_id,
            "attachment_iv": "aXY=",
            "attachment_encrypted_keys": {user_a["user_id"]: "Aw==", user_b["user_id"]: "Bw=="},
            "attachment_content_type": "text/plain",
        }
        r = requests.post(f"{API}/messages", json=attach_msg, headers=auth(token_a), timeout=15)
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/files/{file_id}", headers=auth(token_b), timeout=20)
        assert r2.status_code == 200 and r2.content == cipher, (r2.status_code, r2.text[:200])
        ok(f"file {file_id} (ACL via message)")

    step("Status create + list")
    status_body = {
        "ciphertext": "c3RhdHVz",
        "iv": "aXY=",
        "encrypted_keys": {user_a["user_id"]: "Aw==", user_b["user_id"]: "Bw=="},
        "status_type": "text",
    }
    r = requests.post(f"{API}/statuses", json=status_body, headers=auth(token_a), timeout=15)
    assert r.status_code == 200, r.text
    status_id = r.json()["status_id"]
    r2 = requests.get(f"{API}/statuses", headers=auth(token_b), timeout=15)
    assert status_id in [s["status_id"] for s in r2.json()]
    ok(f"status {status_id}")

    step("Panic wipe (user A)")
    r = requests.post(f"{API}/panic-wipe", headers=auth(token_a), timeout=15)
    assert r.status_code == 200 and r.json().get("ok")
    r2 = requests.get(f"{API}/conversations", headers=auth(token_a), timeout=15)
    assert r2.status_code == 200 and r2.json() == []
    ok("panic wipe")

    print("\nE2E SMOKE PASSED")


if __name__ == "__main__":
    main()