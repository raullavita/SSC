import os
from unittest.mock import patch

from core.turn_proof import calls_public_config, turn_proof_status


def test_calls_public_config_without_turn_creds():
    with patch.dict(os.environ, {"TURN_USERNAME": "", "TURN_CREDENTIAL": ""}, clear=False):
        cfg = calls_public_config()
    assert cfg["turn_configured"] is False
    assert cfg["off_lan_proof_required"] is True
    assert cfg["ice_server_count"] >= 1


def test_calls_public_config_with_metered_turn():
    env = {
        "TURN_USERNAME": "test-user",
        "TURN_CREDENTIAL": "test-pass",
        "SSC_AIR_GAPPED_MODE": "false",
    }
    with patch.dict(os.environ, env, clear=False):
        cfg = calls_public_config()
    assert cfg["turn_configured"] is True
    assert cfg["relay_server_count"] >= 1
    assert cfg["has_metered_relay"] is True


def test_turn_proof_status_config_ready_flag():
    env = {
        "TURN_USERNAME": "test-user",
        "TURN_CREDENTIAL": "test-pass",
        "SSC_AIR_GAPPED_MODE": "false",
    }
    with patch.dict(os.environ, env, clear=False):
        status = turn_proof_status()
    assert status["config_ready"] is True
    assert status["device_proof_done"] is False