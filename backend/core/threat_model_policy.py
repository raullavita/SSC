"""Public threat-model page policy — Q.57."""
from __future__ import annotations

from typing import Tuple

PUBLIC_THREAT_MODEL_ROUTE = "/security"
PUBLIC_THREAT_MODEL_COMPONENT = "frontend/src/pages/ThreatModel.jsx"
SECURITY_MODEL_COMPANION = "memory/SECURITY_MODEL.md"

THREAT_MODEL_SECTIONS: Tuple[str, ...] = (
    "what_we_protect",
    "installed_app_encryption",
    "legacy_compatibility",
    "server_visibility",
    "honest_limits",
    "vulnerability_reporting",
)

THREAT_MODEL_REQUIREMENTS: Tuple[str, ...] = (
    "public_route_linked_from_landing",
    "user_readable_plain_language",
    "companion_to_security_model_md",
    "no_false_signal_claims_for_browser",
)