"""Release policy — Step 18. Version alignment and artifact naming."""

from __future__ import annotations

RELEASE_VERSION = "0.3.1"
RELEASE_BUILD = "9"          # minimum supported client build
CURRENT_BUILD = "10"         # current release build
RELEASE_TAG = f"v{RELEASE_VERSION}"
RELEASE_LABEL = f"v{RELEASE_VERSION} (build {CURRENT_BUILD})"
ELECTRON_ARTIFACT = f"SSC-Setup-{RELEASE_VERSION}.exe"
ANDROID_ARTIFACT = f"SSC-{RELEASE_VERSION}.apk"
ELECTRON_CLIENT_HEADER = f"electron/{RELEASE_VERSION}/{CURRENT_BUILD}"
ANDROID_CLIENT_HEADER = f"android/{RELEASE_VERSION}/{CURRENT_BUILD}"
GITHUB_RELEASE_DOWNLOAD_BASE = (
    f"https://github.com/raullavita/SSC/releases/download/{RELEASE_TAG}"
)


def step18_release_ready() -> bool:
    return bool(RELEASE_VERSION) and RELEASE_VERSION.startswith("0.3.")