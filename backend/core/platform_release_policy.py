"""Platform release policy — Electron + Android installed clients — Engine 11."""

from __future__ import annotations

import os

ELECTRON_LIB_VERSION = os.getenv("SSC_ELECTRON_LIBSIGNAL_VERSION", "0.96.4")
ANDROID_LIB_VERSION = os.getenv("SSC_ANDROID_LIBSIGNAL_VERSION", "0.96.4")
PLATFORM_RELEASE_NO_CLOUD_DEPLOY = True


def engine11_electron_ready() -> bool:
    return bool(ELECTRON_LIB_VERSION)


def engine11_android_ready() -> bool:
    return bool(ANDROID_LIB_VERSION)


def engine11_platform_release_ready() -> bool:
    return engine11_electron_ready() and engine11_android_ready()