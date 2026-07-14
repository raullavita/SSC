"""Per-device ciphertext validation — Sesame-style multi-device messaging."""

from __future__ import annotations

from core.signal_policy import SIGNAL_PROTOCOL_V1, validate_signal_ciphertext


def validate_send_ciphertexts(
    *,
    ciphertext: str | None,
    device_ciphertexts: dict[str, str] | None,
    protocol: str,
) -> tuple[bool, str]:
    """Accept legacy single ciphertext or a non-empty per-device map."""
    if device_ciphertexts:
        if not isinstance(device_ciphertexts, dict) or not device_ciphertexts:
            return False, "device_ciphertexts_empty"
        for device_id, blob in device_ciphertexts.items():
            if not device_id or not str(device_id).strip():
                return False, "device_ciphertexts_invalid_device_id"
            ok, detail = validate_signal_ciphertext(blob, protocol)
            if not ok:
                return False, f"device_{device_id}:{detail}"
        return True, ""

    if not ciphertext:
        return False, "ciphertext_required"
    return validate_signal_ciphertext(ciphertext, protocol)


def resolve_viewer_ciphertext(
    doc: dict,
    *,
    viewer_id: str | None,
    viewer_device_id: str | None,
) -> str | None:
    """
    Pick the ciphertext blob for the viewing device.
    Falls back to legacy single ciphertext field.
    """
    device_map = doc.get("device_ciphertexts") or {}
    if not isinstance(device_map, dict) or not device_map:
        return doc.get("ciphertext")

    if viewer_device_id and viewer_device_id in device_map:
        return device_map[viewer_device_id]

    sender_id = doc.get("sender_id")
    if viewer_id and viewer_id == sender_id:
        if viewer_device_id and viewer_device_id in device_map:
            return device_map[viewer_device_id]
        return next(iter(device_map.values()), doc.get("ciphertext"))

    for _device_id, blob in device_map.items():
        return blob
    return doc.get("ciphertext")


def primary_protocol(doc: dict) -> str:
    return doc.get("protocol") or SIGNAL_PROTOCOL_V1


def filter_device_ciphertexts_for_devices(
    device_map: dict[str, str] | None,
    device_ids: list[str],
) -> dict[str, str]:
    """Keep only ciphertext blobs intended for the given device IDs."""
    if not isinstance(device_map, dict) or not device_map:
        return {}
    allowed = {str(d) for d in device_ids if d}
    if not allowed:
        return dict(device_map)
    filtered = {k: v for k, v in device_map.items() if str(k) in allowed}
    return filtered if filtered else dict(device_map)


def filter_message_doc_for_devices(doc: dict, device_ids: list[str]) -> dict:
    """Return a shallow copy with device_ciphertexts limited to device_ids."""
    device_map = doc.get("device_ciphertexts") or {}
    if not isinstance(device_map, dict) or not device_map:
        return doc
    filtered = filter_device_ciphertexts_for_devices(device_map, device_ids)
    if filtered == device_map:
        return doc
    return {**doc, "device_ciphertexts": filtered}


async def participant_device_ids(db, user_id: str) -> list[str]:
    """Registered device IDs for a user; defaults to primary device 1."""
    cursor = db.devices.find({"user_id": user_id}, {"device_id": 1})
    ids = [str(d.get("device_id")) async for d in cursor if d.get("device_id")]
    return ids or ["1"]