"""Q.36 — email verification JWT tests."""
import jwt

from core.config import JWT_SECRET
from core.email_verification_tokens import (
    decode_email_verification_token,
    make_email_verification_token,
)


def test_round_trip_token():
    token = make_email_verification_token("u_abc", "user@example.com")
    payload = decode_email_verification_token(token)
    assert payload["sub"] == "u_abc"
    assert payload["email"] == "user@example.com"
    assert payload["purpose"] == "email_verify"


def test_rejects_wrong_purpose():
    token = make_email_verification_token("u_abc", "user@example.com")
    payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    payload["purpose"] = "login"
    bad = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    assert decode_email_verification_token(bad) is None


def test_rejects_garbage_token():
    assert decode_email_verification_token("not-a-jwt") is None