"""Engine 2 Step 2.5 — E2E-only file upload/download."""
import pytest
from pathlib import Path

from fastapi import HTTPException

from core.file_integrity import (
    LEGACY_DOWNLOAD_REJECTED,
    PLAIN_UPLOAD_REJECTED,
    is_encrypted_upload_flag,
    require_encrypted_file_record,
    require_encrypted_upload,
)


@pytest.mark.parametrize("value,expected", [
    ("true", True),
    ("TRUE", True),
    ("1", True),
    ("yes", True),
    (None, False),
    ("false", False),
    ("", False),
])
def test_is_encrypted_upload_flag(value, expected):
    assert is_encrypted_upload_flag(value) is expected


def test_require_encrypted_upload_rejects_plaintext():
    with pytest.raises(HTTPException) as exc:
        require_encrypted_upload(None)
    assert exc.value.status_code == 400
    assert exc.value.detail == PLAIN_UPLOAD_REJECTED


def test_require_encrypted_upload_accepts_flag():
    require_encrypted_upload("true")


def test_require_encrypted_file_record_rejects_legacy():
    with pytest.raises(HTTPException) as exc:
        require_encrypted_file_record({"file_id": "f_1", "encrypted": False})
    assert exc.value.status_code == 410
    assert exc.value.detail == LEGACY_DOWNLOAD_REJECTED


def test_require_encrypted_file_record_accepts_e2e():
    require_encrypted_file_record({"file_id": "f_1", "encrypted": True})


def test_files_router_enforces_e2e_integrity():
    text = (Path(__file__).resolve().parents[1] / "routers" / "files.py").read_text(encoding="utf-8")
    assert "require_encrypted_upload" in text
    assert "require_encrypted_file_record" in text


def test_frontend_no_legacy_attachment_fetch():
    text = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "components" / "Message.jsx").read_text(encoding="utf-8")
    assert "LegacyAttachmentPlaceholder" in text
    assert "useLegacyFileBlob" not in text
    assert "fetchFileBlob" not in text


def test_chat_home_uploads_encrypted_only():
    text = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "pages" / "ChatHome.jsx").read_text(encoding="utf-8")
    assert "uploadEncryptedAttachment" in text
    assert "encrypted', 'true'" in text or 'encrypted", "true"' in text or "encrypted', 'true'" in text