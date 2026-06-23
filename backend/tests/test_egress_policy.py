"""Engine 1 Step 1.6 — third-party egress map and air-gapped mode."""
import os
from unittest.mock import patch

import pytest

from core.egress_policy import (
    EGRESS_CATALOG,
    EGRESS_IDS,
    air_gap_violations,
    build_ice_servers,
    egress_feature_enabled,
    egress_status_map,
    is_air_gapped_mode,
    is_mongo_remote,
    is_service_enabled,
    validate_air_gap_at_startup,
)
from core.retention_policy import THIRD_PARTY_EGRESS


def test_egress_catalog_matches_retention_policy():
    policy_ids = {e["id"] for e in THIRD_PARTY_EGRESS}
    assert set(EGRESS_IDS) == policy_ids
    for sid in EGRESS_IDS:
        assert EGRESS_CATALOG[sid]["service"] == next(
            e["service"] for e in THIRD_PARTY_EGRESS if e["id"] == sid
        )


def test_is_mongo_remote_detects_atlas():
    with patch.dict(os.environ, {"MONGO_URL": "mongodb+srv://u:p@cluster.mongodb.net/ssc"}, clear=False):
        assert is_mongo_remote() is True
    with patch.dict(os.environ, {"MONGO_URL": "mongodb://localhost:27017"}, clear=False):
        assert is_mongo_remote() is False


def test_air_gap_blocks_translation_even_when_enabled():
    env = {
        "SSC_AIR_GAPPED_MODE": "true",
        "TRANSLATION_ENABLED": "true",
        "TRANSLATION_PROVIDER": "mymemory",
    }
    with patch.dict(os.environ, env, clear=False):
        assert is_air_gapped_mode() is True
        assert is_service_enabled("translation") is True
        assert egress_feature_enabled("translation") is False
        from core.translation_access import is_translation_allowed
        assert is_translation_allowed() is False


def test_air_gap_blocks_google_oauth():
    env = {
        "SSC_AIR_GAPPED_MODE": "true",
        "GOOGLE_CLIENT_ID": "cid",
        "GOOGLE_CLIENT_SECRET": "sec",
        "GOOGLE_REDIRECT_URI": "http://localhost/cb",
    }
    with patch.dict(os.environ, env, clear=False):
        from core.google_auth import is_configured
        assert is_service_enabled("google_oauth") is True
        assert is_configured() is False


def test_build_ice_servers_no_third_party_when_air_gapped():
    with patch.dict(
        os.environ,
        {"SSC_AIR_GAPPED_MODE": "true", "TURN_USERNAME": "u", "TURN_CREDENTIAL": "p"},
        clear=False,
    ):
        servers = build_ice_servers()
        urls = " ".join(s["urls"] for s in servers)
        assert "google.com" not in urls
        assert "metered.ca" not in urls


def test_build_ice_servers_self_hosted_when_air_gapped():
    env = {
        "SSC_AIR_GAPPED_MODE": "true",
        "SSC_STUN_URLS": "stun:turn.local:3478",
        "SSC_TURN_URLS": "turn:turn.local:3478",
        "TURN_USERNAME": "ssc",
        "TURN_CREDENTIAL": "secret",
    }
    with patch.dict(os.environ, env, clear=False):
        servers = build_ice_servers()
        assert len(servers) == 2
        assert servers[0]["urls"] == "stun:turn.local:3478"
        assert servers[1]["username"] == "ssc"


def test_air_gap_violations_lists_active_egress():
    env = {
        "SSC_AIR_GAPPED_MODE": "true",
        "TRANSLATION_ENABLED": "true",
        "TRANSLATION_PROVIDER": "mymemory",
        "VAPID_PRIVATE": "key",
    }
    with patch.dict(os.environ, env, clear=False):
        violations = air_gap_violations()
        assert "translation" in violations
        assert "web_push" in violations


def test_egress_status_map_shape():
    with patch.dict(os.environ, {"SSC_AIR_GAPPED_MODE": "false"}, clear=False):
        status = egress_status_map()
    assert "air_gapped_mode" in status
    assert "air_gap_compliant" in status
    assert "third_party_egress" in status
    assert len(status["third_party_egress"]) == len(EGRESS_IDS)


def test_air_gap_strict_raises_on_violations():
    env = {
        "SSC_AIR_GAPPED_MODE": "true",
        "SSC_AIR_GAPPED_STRICT": "true",
        "TRANSLATION_ENABLED": "true",
        "TRANSLATION_PROVIDER": "mymemory",
    }
    import logging
    log = logging.getLogger("test-egress")
    with patch.dict(os.environ, env, clear=False):
        with pytest.raises(RuntimeError, match="SSC_AIR_GAPPED_STRICT"):
            validate_air_gap_at_startup(log)


def test_config_route_exposes_egress_map():
    from pathlib import Path
    text = (Path(__file__).resolve().parents[1] / "routers" / "config_route.py").read_text(encoding="utf-8")
    assert "egress_status_map" in text
    assert "build_ice_servers" in text
    assert "air_gapped_mode" in text