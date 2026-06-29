"""Engine 8 Step 8.1 — Signal Protocol policy tests."""
from core.signal_policy import (
    APPROVED_LIB_SOURCES,
    ENGINE8_STEPS,
    PUBLIC_PREKEY_FIELDS,
    SECRET_SERVER_FIELDS,
    ProtocolVersion,
    engine8_prerequisites_met,
    engine8_step_81_complete,
    is_forbidden_lib_name,
    open_signal_gaps,
)


def test_engine8_prerequisites():
    assert engine8_prerequisites_met() is True


def test_step_81_complete():
    assert engine8_step_81_complete() is True


def test_approved_sources_are_official():
    assert "libsignal_repo" in APPROVED_LIB_SOURCES
    assert "signalapp" in APPROVED_LIB_SOURCES["libsignal_repo"].url
    assert "npm_libsignal_client" in APPROVED_LIB_SOURCES
    assert "@signalapp" in APPROVED_LIB_SOURCES["npm_libsignal_client"].name
    assert "build-artifacts.signal.org" in APPROVED_LIB_SOURCES["maven_libsignal_android"].url


def test_forbidden_community_libs():
    assert is_forbidden_lib_name("libsignal-protocol-javascript") is True
    assert is_forbidden_lib_name("@privacyresearch/libsignal-protocol-typescript") is True
    assert is_forbidden_lib_name("@signalapp/libsignal-client") is False


def test_open_signal_gaps_empty():
    gaps = {g.gap_id for g in open_signal_gaps()}
    assert gaps == set()


def test_protocol_versions():
    assert ProtocolVersion.LEGACY_RSA.value == "legacy_rsa"
    assert ProtocolVersion.SIGNAL_V1.value == "signal_v1"


def test_prekey_fields_never_include_secrets():
    assert not PUBLIC_PREKEY_FIELDS & SECRET_SERVER_FIELDS


def test_engine8_steps_all_done():
    done = [step for step, _, flag in ENGINE8_STEPS if flag]
    assert done == [
        "8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8",
        "8.9", "8.11", "8.12",
    ]


def test_engine8_complete():
    from core.signal_policy import engine8_complete

    assert engine8_complete() is True


def test_libsignal_pinned_version():
    from core.signal_policy import LIBSIGNAL_PINNED_VERSION

    assert LIBSIGNAL_PINNED_VERSION == "0.96.4"