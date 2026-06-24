"""Engine 3 Steps 3.2–3.5 — memory wipe, SW cache, localStorage panic, IndexedDB purge."""
from pathlib import Path


def test_memory_wipe_module_exists():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "memoryWipe.js").read_text(encoding="utf-8")
    assert "dispatchMemoryWipe" in text
    assert "registerBlobUrl" in text
    assert "registerSocketCloser" in text
    assert "registerMemoryWipeHandler" in text
    assert "MEMORY_WIPE_EVENT" in text


def test_auth_context_uses_footprint_orchestrator():
    root = Path(__file__).resolve().parents[2]
    auth = (root / "frontend" / "src" / "context" / "AuthContext.jsx").read_text(encoding="utf-8")
    orch = (root / "frontend" / "src" / "lib" / "clientFootprintOrchestrator.js").read_text(encoding="utf-8")
    assert "runLogoutOrchestrator" in auth
    assert "runPanicOrchestrator" in auth
    panic_start = orch.index("export async function runPanicOrchestrator")
    panic_body = orch[panic_start:]
    assert panic_body.index("executeClientFootprintWipe") < panic_body.index("await postPanicWipe")


def test_chat_home_registers_wipe_handlers():
    root = Path(__file__).resolve().parents[2]
    chat = (root / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    assert "registerMemoryWipeHandler" in chat
    assert "registerSocketCloser" in chat
    assert "setDecryptedBodies({})" in chat
    assert "setMessages([])" in chat


def test_message_tracks_blob_urls_and_wipe_listener():
    root = Path(__file__).resolve().parents[2]
    msg = (root / "frontend" / "src" / "components" / "Message.jsx").read_text(encoding="utf-8")
    assert "registerBlobUrl" in msg
    assert "subscribeMemoryWipe" in msg
    assert "setPlaintext(null)" in msg


def test_stories_viewer_clears_decoded_on_wipe():
    root = Path(__file__).resolve().parents[2]
    stories = (root / "frontend" / "src" / "components" / "Stories.jsx").read_text(encoding="utf-8")
    assert "subscribeMemoryWipe" in stories
    assert "setDecoded('')" in stories


def test_service_worker_cache_module_exists():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "serviceWorkerCache.js").read_text(encoding="utf-8")
    assert "purgeServiceWorkerCaches" in text
    assert "SW_PURGE_CACHES_MESSAGE" in text
    assert "SSC_PURGE_CACHES" in text
    assert "SSC_CACHE_NAME" in text
    assert "ssc-v1" in text
    assert "caches.delete" in text


def test_sw_js_handles_purge_caches_message():
    root = Path(__file__).resolve().parents[2]
    sw = (root / "frontend" / "public" / "sw.js").read_text(encoding="utf-8")
    assert "SSC_PURGE_CACHES" in sw
    assert "caches.keys()" in sw
    assert "caches.delete" in sw
    assert "event.waitUntil" in sw


def test_memory_wipe_invokes_service_worker_cache_purge():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "memoryWipe.js").read_text(encoding="utf-8")
    assert "purgeServiceWorkerCaches" in text
    assert "from './serviceWorkerCache'" in text


def test_local_storage_footprint_module_exists():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "localStorageFootprint.js").read_text(encoding="utf-8")
    assert "applyLocalStoragePanicPolicy" in text
    assert "purgeVerificationStorageOnPanic" in text
    assert "reason !== 'panic'" in text


def test_verification_has_panic_purge():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "verification.js").read_text(encoding="utf-8")
    assert "purgeVerificationStorageOnPanic" in text
    assert "VERIFICATION_STORAGE_V2_PREFIX" in text
    assert "ssc_verified_v2_" in text


def test_memory_wipe_applies_local_storage_panic_policy():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "memoryWipe.js").read_text(encoding="utf-8")
    assert "applyLocalStoragePanicPolicy" in text
    assert "from './localStorageFootprint'" in text
    assert text.index("applyLocalStoragePanicPolicy") < text.index("purgeServiceWorkerCaches")


def test_logout_keeps_verification_records():
    root = Path(__file__).resolve().parents[2]
    footprint = (root / "frontend" / "src" / "lib" / "localStorageFootprint.js").read_text(encoding="utf-8")
    auth = (root / "frontend" / "src" / "context" / "AuthContext.jsx").read_text(encoding="utf-8")
    assert "reason !== 'panic'" in footprint
    assert "purgeVerificationStorageOnPanic" not in auth
    assert "purgeAllVerification" not in auth


def test_indexeddb_purge_runs_on_every_wipe():
    root = Path(__file__).resolve().parents[2]
    text = (root / "frontend" / "src" / "lib" / "memoryWipe.js").read_text(encoding="utf-8")
    assert "purgeIndexedDBFootprint().catch" in text
    body_start = text.index("export function dispatchMemoryWipe")
    assert "purgeIndexedDBFootprint().catch" in text[body_start:]