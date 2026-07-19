"""Release policy — Step 18. Version alignment and artifact naming."""

from __future__ import annotations

# Native Android track (Compose). Desktop Qt / iOS follow same marketing version when shipped.
RELEASE_VERSION = "0.4.0"
RELEASE_BUILD = "15"
RELEASE_TAG = f"v{RELEASE_VERSION}"
RELEASE_LABEL = f"v{RELEASE_VERSION} (build {RELEASE_BUILD})"
# Legacy Electron artifact name (no longer product path).
ELECTRON_ARTIFACT = f"SSC-Setup-{RELEASE_VERSION}.exe"
ANDROID_ARTIFACT = f"SSC-{RELEASE_VERSION}.apk"
ELECTRON_CLIENT_HEADER = f"electron/{RELEASE_VERSION}/{RELEASE_BUILD}"
ANDROID_CLIENT_HEADER = f"android/{RELEASE_VERSION}/{RELEASE_BUILD}"
GITHUB_RELEASE_DOWNLOAD_BASE = (
    f"https://github.com/raullavita/SSC/releases/download/{RELEASE_TAG}"
)


def step18_release_ready() -> bool:
    return bool(RELEASE_VERSION) and (
        RELEASE_VERSION.startswith("0.3.") or RELEASE_VERSION.startswith("0.4.")
    )
