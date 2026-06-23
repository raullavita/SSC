"""File upload/download E2E integrity — Engine 2 Step 2.5. See memory/E2E_INTEGRITY_CHARTER.md §4.2."""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

PLAIN_UPLOAD_REJECTED = (
    "Plaintext file upload is deprecated. Upload ciphertext with encrypted=true."
)
LEGACY_DOWNLOAD_REJECTED = (
    "Legacy plaintext file download is no longer available. E2E encryption required."
)


def is_encrypted_upload_flag(encrypted: Optional[str]) -> bool:
    return (encrypted or "").lower() in ("1", "true", "yes")


def require_encrypted_upload(encrypted: Optional[str]) -> None:
    """Reject new plaintext uploads (G4)."""
    if not is_encrypted_upload_flag(encrypted):
        raise HTTPException(400, PLAIN_UPLOAD_REJECTED)


def require_encrypted_file_record(record: dict) -> None:
    """Reject serving legacy plaintext blobs (G8)."""
    if not record.get("encrypted"):
        raise HTTPException(410, LEGACY_DOWNLOAD_REJECTED)