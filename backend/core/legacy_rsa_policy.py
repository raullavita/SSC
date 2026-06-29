"""Legacy RSA send retirement — Q.54 (installed clients decrypt-only)."""
from __future__ import annotations

from fastapi import HTTPException, Request

from core.auth import is_installed_client_request
from core.signal_policy import ProtocolVersion

INSTALLED_LEGACY_RSA_SEND_RETIRED = True


def reject_legacy_rsa_send_for_installed(request: Request, protocol: str) -> None:
    """Block new legacy_rsa ciphertext from installed APK/desktop clients."""
    if not INSTALLED_LEGACY_RSA_SEND_RETIRED:
        return
    if not is_installed_client_request(request):
        return
    if (protocol or "").strip().lower() == ProtocolVersion.LEGACY_RSA.value:
        raise HTTPException(
            403,
            "legacy_rsa_send_retired: installed clients must use Signal protocol",
        )