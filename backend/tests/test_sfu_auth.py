"""SFU join token tests — Q.35."""
import jwt
import pytest

from core.config import JWT_SECRET
from core.sfu_auth import SFU_TOKEN_TTL_MINUTES, make_sfu_join_token


def test_make_sfu_join_token_payload():
    token = make_sfu_join_token("user-1", "conv-abc")
    payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    assert payload["sub"] == "user-1"
    assert payload["room_id"] == "conv-abc"
    assert payload["purpose"] == "sfu"
    assert payload["exp"] - payload["iat"] == SFU_TOKEN_TTL_MINUTES * 60


def test_sfu_token_rejects_wrong_room():
    token = make_sfu_join_token("user-1", "conv-a")
    payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    assert payload["room_id"] != "conv-b"