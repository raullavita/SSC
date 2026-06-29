"""AGPL compliance policy tests."""
import re
from pathlib import Path

from core.agpl_policy import (
    AGPL_ARTIFACTS,
    AGPL_ANDROID_PROOF_PATHS,
    AGPL_STEPS,
    COPYLEFT_DEPENDENCIES,
    LIBSIGNAL_LICENSE,
    PLAY_STORE_SOURCE_SNIPPET,
    SOURCE_REPO_URL,
    SSC_LICENSE,
    agpl_review_complete,
    shipped_copyleft_deps,
)
from core.signal_policy import LIBSIGNAL_PINNED_VERSION

REPO = Path(__file__).resolve().parents[2]


def test_agpl_steps_complete():
    assert agpl_review_complete() is True
    assert all(done for _, _, done in AGPL_STEPS)


def test_ssc_license_is_agpl():
    assert SSC_LICENSE == "AGPL-3.0"


def test_libsignal_is_copyleft_and_shipped():
    shipped = shipped_copyleft_deps()
    assert len(shipped) == 1
    assert shipped[0].name == "libsignal"
    assert shipped[0].version == LIBSIGNAL_PINNED_VERSION
    assert shipped[0].license_id == LIBSIGNAL_LICENSE


def test_agpl_artifacts_exist():
    for rel in AGPL_ARTIFACTS:
        assert (REPO / rel).is_file(), rel


def test_root_license_contains_agpl():
    text = (REPO / "LICENSE").read_text(encoding="utf-8")
    assert "GNU AFFERO GENERAL PUBLIC LICENSE" in text
    assert "SSC (Super Secure Chat)" in text
    assert SOURCE_REPO_URL in text


def test_third_party_notices_mention_libsignal():
    text = (REPO / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
    assert "libsignal" in text
    assert LIBSIGNAL_PINNED_VERSION in text
    assert "AGPL" in text


def test_android_build_gradle_pins_libsignal():
    gradle = (REPO / AGPL_ANDROID_PROOF_PATHS[0]).read_text(encoding="utf-8")
    assert f"libsignal-android:{LIBSIGNAL_PINNED_VERSION}" in gradle
    assert f"libsignal-client:{LIBSIGNAL_PINNED_VERSION}" in gradle


def test_open_source_licenses_module_has_source_url():
    js = (REPO / "frontend/src/lib/openSourceLicenses.js").read_text(encoding="utf-8")
    assert SOURCE_REPO_URL in js
    assert "LIBSIGNAL_PINNED_VERSION" in js
    assert "libsignal" in js


def test_settings_modal_links_open_source():
    jsx = (REPO / "frontend/src/components/SettingsModal.jsx").read_text(encoding="utf-8")
    assert "openSourceLicenses" in jsx or "OpenSource" in jsx
    assert "settingsOpenSource" in jsx or "open-source" in jsx.lower()


def test_play_store_snippet_has_repo():
    assert SOURCE_REPO_URL in PLAY_STORE_SOURCE_SNIPPET


def test_compliance_doc_exists_and_covers_play_store():
    text = (REPO / "memory/AGPL_COMPLIANCE.md").read_text(encoding="utf-8")
    assert "Play Store" in text
    assert SOURCE_REPO_URL in text
    assert re.search(
        rf"libsignal.*{re.escape(LIBSIGNAL_PINNED_VERSION)}|{re.escape(LIBSIGNAL_PINNED_VERSION)}.*libsignal",
        text,
    )