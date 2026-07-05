"""Release policy — Step 18. Version alignment and artifact naming for v0.3.0."""

from __future__ import annotations

RELEASE_VERSION = "0.3.0"
RELEASE_TAG = f"v{RELEASE_VERSION}"
ELECTRON_ARTIFACT = f"SSC-Setup-{RELEASE_VERSION}.exe"
ANDROID_ARTIFACT = f"SSC-{RELEASE_VERSION}.apk"
ANDROID_CLIENT_HEADER = f"android/{RELEASE_VERSION}/6"


def step18_release_ready() -> bool:
    return bool(RELEASE_VERSION) and RELEASE_VERSION.startswith("0.3.")