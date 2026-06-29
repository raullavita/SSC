"""Responsible disclosure policy — Q.58 (disclose.io VDP + RFC 9116 security.txt)."""
from __future__ import annotations

from typing import Tuple

ORGANIZATION = "Super Secure Chat (SSC)"
CONTACT_EMAIL = "contact@supersecurechat.com"
GITHUB_ADVISORY_URL = "https://github.com/raullavita/SSC/security/advisories/new"
GITHUB_ADVISORIES_URL = "https://github.com/raullavita/SSC/security/advisories"
SITE_ORIGIN = "https://www.supersecurechat.com"
API_ORIGIN = "https://api.supersecurechat.com"
VDP_PUBLIC_PATH = "/vdp"
VDP_PUBLIC_URL = f"{SITE_ORIGIN}{VDP_PUBLIC_PATH}"
SECURITY_TXT_WEB_PATH = "/.well-known/security.txt"
SECURITY_TXT_API_PATH = "/.well-known/security.txt"
DISCLOSURE_WINDOW_DAYS = 90
SECURITY_TXT_EXPIRES = "2027-06-29T23:59:59.000Z"
PREFERRED_LANGUAGES = "en, es, ro"

DISCLOSE_IO_FRAMEWORK = "disclose.io core-terms-vdp"
VDP_POLICY_REPO_PATH = "VULNERABILITY_DISCLOSURE_POLICY.md"

IN_SCOPE_ASSETS: Tuple[str, ...] = (
    "https://www.supersecurechat.com",
    "https://api.supersecurechat.com",
    "SSC Android APK and Windows/Mac desktop clients (installed builds)",
    "Public GitHub repository https://github.com/raullavita/SSC",
)

OUT_OF_SCOPE: Tuple[str, ...] = (
    "Third-party services (Google Cloud, MongoDB Atlas, Firebase, Metered TURN, etc.)",
    "Other users' accounts, devices, or data without explicit written permission",
    "Denial-of-service or load tests against production",
    "Social engineering, phishing, or physical attacks",
    "Issues in outdated or unofficial client builds",
)

OFFICIAL_CHANNELS: Tuple[str, ...] = (
    GITHUB_ADVISORY_URL,
    f"mailto:{CONTACT_EMAIL}",
)


def render_security_txt(*, canonical_origin: str = SITE_ORIGIN) -> str:
    """RFC 9116 security.txt body."""
    canonical = f"{canonical_origin.rstrip('/')}{SECURITY_TXT_WEB_PATH}"
    lines = [
        f"Contact: mailto:{CONTACT_EMAIL}",
        f"Contact: {GITHUB_ADVISORY_URL}",
        f"Expires: {SECURITY_TXT_EXPIRES}",
        f"Preferred-Languages: {PREFERRED_LANGUAGES}",
        f"Canonical: {canonical}",
        f"Policy: {VDP_PUBLIC_URL}",
        f"Acknowledgments: {GITHUB_ADVISORIES_URL}",
        f"Hiring: {SITE_ORIGIN}/#contact",
    ]
    return "\n".join(lines) + "\n"


def security_txt_has_required_fields(body: str) -> bool:
    lower = (body or "").lower()
    required = ("contact:", "expires:", "policy:")
    return all(token in lower for token in required)


def vdp_has_safe_harbor(text: str) -> bool:
    lower = (text or "").lower()
    return "safe harbor" in lower and "good faith" in lower