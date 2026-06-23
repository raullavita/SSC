"""Gate server-side translation — plaintext must never leave the client by default."""
import os

TRANSLATION_DISABLED_DETAIL = (
    "Server-side translation is disabled. "
    "Enabling it sends decrypted message text to third-party services and breaks full E2E privacy. "
    "Set TRANSLATION_ENABLED=true in backend .env only if you accept that tradeoff."
)


def translation_provider() -> str:
    return (os.environ.get("TRANSLATION_PROVIDER") or "mymemory").lower().strip()


def is_translation_enabled_flag() -> bool:
    return os.environ.get("TRANSLATION_ENABLED", "false").lower() == "true"


def is_translation_allowed() -> bool:
    """True only when explicitly enabled, provider is not 'none', and egress policy allows."""
    from core.egress_policy import egress_feature_enabled

    if not egress_feature_enabled("translation"):
        return False
    if not is_translation_enabled_flag():
        return False
    return translation_provider() != "none"