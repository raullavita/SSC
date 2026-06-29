"""
Engine 10 — desktop clients (Windows + Mac) with official libsignal.

Replaces retired Engine 8.10 (browser WASM). See memory/DESKTOP_CLIENT_CHARTER.md.
"""
from __future__ import annotations

from typing import List, Tuple

from core.signal_policy import LIBSIGNAL_PINNED_VERSION

PRODUCT_SURFACES: Tuple[str, ...] = (
    "android_apk",
    "windows_desktop",
    "mac_desktop",
)

RETIRED_SURFACES: Tuple[str, ...] = (
    "browser_pwa_product",
    "engine_8_10_browser_wasm",
)

DESKTOP_LIB_PACKAGE = "@signalapp/libsignal-client"
DESKTOP_ELECTRON_DIR = "frontend/desktop"
DESKTOP_CHARTER = "memory/DESKTOP_CLIENT_CHARTER.md"

ENGINE10_STEPS: List[Tuple[str, str, bool]] = [
    ("10.1", "Desktop charter + policy + Electron scaffold", True),
    ("10.2", "libsignal IPC bridge (Node native 0.96.4)", True),
    ("10.3", "Windows installer (electron-builder nsis)", True),
    ("10.4", "Mac build config (dmg — build on macOS)", True),
    ("10.5", "Engine 10 gate + frontend platform wiring", True),
]

GROUP_VIDEO_MAX_PARTICIPANTS = 8
GROUP_VIDEO_MESH_MAX = 8


def engine10_complete() -> bool:
    return all(done for _, _, done in ENGINE10_STEPS)


def is_product_surface(surface: str) -> bool:
    return surface in PRODUCT_SURFACES


def browser_pwa_is_product() -> bool:
    return False