"""
AGPL compliance policy — machine-readable mirror of memory/AGPL_COMPLIANCE.md.

Play Store / Firebase App Distribution conveyance of the Android APK requires
AGPL-3.0 compliance because libsignal is linked in the binary.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

from core.signal_policy import LIBSIGNAL_PINNED_VERSION

SSC_LICENSE = "AGPL-3.0"
SSC_COPYRIGHT_HOLDER = "SSC contributors"
SOURCE_REPO_URL = "https://github.com/raullavita/SSC"
SOURCE_REPO_PATH = "raullavita/SSC"

LIBSIGNAL_LICENSE = "AGPL-3.0"
LIBSIGNAL_UPSTREAM_URL = "https://github.com/signalapp/libsignal"
LIBSIGNAL_UPSTREAM_TAG = f"v{LIBSIGNAL_PINNED_VERSION}"

MEDIASOUP_LICENSE = "AGPL-3.0"
MEDIASOUP_UPSTREAM_URL = "https://github.com/versatica/mediasoup"
MEDIASOUP_DEPLOYED = False

PLAY_STORE_SOURCE_SNIPPET = (
    "SSC is licensed under the GNU Affero General Public License v3.0. "
    f"Source code: {SOURCE_REPO_URL}"
)

AGPL_ARTIFACTS: Tuple[str, ...] = (
    "memory/AGPL_COMPLIANCE.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "frontend/src/lib/openSourceLicenses.js",
)

AGPL_ANDROID_PROOF_PATHS: Tuple[str, ...] = (
    "frontend/android/app/build.gradle",
    "frontend/android/app/src/main/java/chat/ssc/secure/plugins/SscLibsignalPlugin.java",
)

AGPL_STEPS: List[Tuple[str, str, bool]] = [
    ("L1", "AGPL compliance review (memory/AGPL_COMPLIANCE.md)", True),
    ("L2", "Root LICENSE (AGPL-3.0)", True),
    ("L3", "THIRD_PARTY_NOTICES.md", True),
    ("L4", "Machine-readable policy (this module)", True),
    ("L5", "In-app source offer + open-source notices UI", True),
    ("L6", "Play Store listing text drafted (founder paste)", True),
]


@dataclass(frozen=True)
class CopyleftDependency:
    name: str
    version: str
    license_id: str
    upstream_url: str
    shipped_in_android_apk: bool
    deployed: bool


COPYLEFT_DEPENDENCIES: Tuple[CopyleftDependency, ...] = (
    CopyleftDependency(
        name="libsignal",
        version=LIBSIGNAL_PINNED_VERSION,
        license_id=LIBSIGNAL_LICENSE,
        upstream_url=LIBSIGNAL_UPSTREAM_URL,
        shipped_in_android_apk=True,
        deployed=True,
    ),
    CopyleftDependency(
        name="mediasoup",
        version="planned",
        license_id=MEDIASOUP_LICENSE,
        upstream_url=MEDIASOUP_UPSTREAM_URL,
        shipped_in_android_apk=False,
        deployed=MEDIASOUP_DEPLOYED,
    ),
)


def agpl_review_complete() -> bool:
    return all(done for _, _, done in AGPL_STEPS)


def shipped_copyleft_deps() -> List[CopyleftDependency]:
    return [d for d in COPYLEFT_DEPENDENCIES if d.shipped_in_android_apk and d.deployed]