"""Engine 4 completion registry."""

from __future__ import annotations

from core.metadata_policy import engine4_metadata_policy_ready


def engine4_complete() -> bool:
    return engine4_metadata_policy_ready()