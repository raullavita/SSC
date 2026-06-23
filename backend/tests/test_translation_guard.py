"""Engine 1 Step 1.2 — server-side translation must be off by default."""
import os
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.auth import get_current_user
from core.translation_access import TRANSLATION_DISABLED_DETAIL, is_translation_allowed
from routers.translate import router

FAKE_USER = {"user_id": "u_test", "username": "testuser"}


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/translate")
    app.dependency_overrides[get_current_user] = lambda: FAKE_USER
    return TestClient(app)


def test_is_translation_allowed_false_by_default():
    with patch.dict(os.environ, {"TRANSLATION_ENABLED": "false"}, clear=False):
        assert is_translation_allowed() is False


def test_is_translation_allowed_false_when_provider_none():
    with patch.dict(
        os.environ,
        {"TRANSLATION_ENABLED": "true", "TRANSLATION_PROVIDER": "none"},
        clear=False,
    ):
        assert is_translation_allowed() is False


def test_is_translation_allowed_true_when_explicitly_enabled():
    with patch.dict(
        os.environ,
        {"TRANSLATION_ENABLED": "true", "TRANSLATION_PROVIDER": "mymemory"},
        clear=False,
    ):
        assert is_translation_allowed() is True


def test_translate_route_returns_403_when_disabled():
    with patch("routers.translate.is_translation_allowed", return_value=False):
        client = _client()
        r = client.post(
            "/api/translate",
            json={"text": "secret message", "target_language": "es"},
        )
        assert r.status_code == 403
        assert "disabled" in r.json()["detail"].lower()
        assert TRANSLATION_DISABLED_DETAIL in r.json()["detail"]


def test_translate_route_rejects_empty_body_when_enabled():
    with patch("routers.translate.is_translation_allowed", return_value=True):
        with patch(
            "routers.translate.translate_text",
            return_value=("hola", "mymemory", None),
        ):
            client = _client()
            r = client.post("/api/translate", json={"text": "", "target_language": "es"})
            assert r.status_code == 400


def test_translate_route_works_when_explicitly_enabled():
    with patch("routers.translate.is_translation_allowed", return_value=True):
        with patch(
            "routers.translate.translate_text",
            return_value=("hello", "mymemory", None),
        ):
            client = _client()
            r = client.post(
                "/api/translate",
                json={"text": "hola", "target_language": "en", "source_language": "es"},
            )
            assert r.status_code == 200
            assert r.json()["translated"] == "hello"
            assert r.json()["provider"] == "mymemory"