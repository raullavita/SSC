"""Platform release policy tests — Engine 11."""

from __future__ import annotations

from core.engine11 import ENGINE11_STEPS, engine11_complete
from core.platform_release_policy import (
    ANDROID_LIB_VERSION,
    ELECTRON_LIB_VERSION,
    engine11_platform_release_ready,
)


def test_platform_lib_versions():
    assert ELECTRON_LIB_VERSION == "0.96.4"
    assert ANDROID_LIB_VERSION == "0.46.0"
    assert engine11_platform_release_ready() is True


def test_engine11_steps_count():
    assert len(ENGINE11_STEPS) == 12


def test_engine11_complete_helper():
    assert engine11_complete() is True