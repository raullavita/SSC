"""Transactional email sender — SMTP or Cloudflare Email REST (Q.36)."""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from typing import Optional

import requests

from core.config import ENV
from core.email_verification_policy import email_from_address, email_from_name
from core.logging_config import logger


class EmailSendError(RuntimeError):
    pass


def email_sender_configured() -> bool:
    if _cloudflare_email_configured():
        return True
    if _smtp_configured():
        return True
    return False


def _smtp_configured() -> bool:
    return bool((os.environ.get("SMTP_HOST") or "").strip())


def _cloudflare_email_configured() -> bool:
    return bool(
        (os.environ.get("CLOUDFLARE_EMAIL_API_TOKEN") or "").strip()
        and (os.environ.get("CLOUDFLARE_ACCOUNT_ID") or "").strip()
    )


def _send_smtp(*, to_email: str, subject: str, html: str, text: str) -> None:
    host = (os.environ.get("SMTP_HOST") or "").strip()
    port = int(os.environ.get("SMTP_PORT") or "587")
    user = (os.environ.get("SMTP_USER") or "").strip()
    password = (os.environ.get("SMTP_PASSWORD") or "").strip()
    use_tls = (os.environ.get("SMTP_USE_TLS") or "true").lower() in ("1", "true", "yes")
    from_addr = email_from_address()
    if not host or not from_addr:
        raise EmailSendError("smtp_not_configured")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{email_from_name()} <{from_addr}>"
    msg["To"] = to_email
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if use_tls:
            smtp.starttls()
        if user and password:
            smtp.login(user, password)
        smtp.send_message(msg)


def _send_cloudflare(*, to_email: str, subject: str, html: str, text: str) -> None:
    token = (os.environ.get("CLOUDFLARE_EMAIL_API_TOKEN") or "").strip()
    account_id = (os.environ.get("CLOUDFLARE_ACCOUNT_ID") or "").strip()
    from_addr = email_from_address()
    if not token or not account_id or not from_addr:
        raise EmailSendError("cloudflare_email_not_configured")

    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/email/sending/send"
    payload = {
        "to": [{"email": to_email}],
        "from": {"address": from_addr, "name": email_from_name()},
        "subject": subject,
        "html": html,
        "text": text,
    }
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=20,
    )
    if resp.status_code >= 400:
        raise EmailSendError(f"cloudflare_email_http_{resp.status_code}")


async def send_verification_email(*, to_email: str, username: str, verify_url: str) -> Optional[str]:
    """
    Send activation email. Returns dev-only URL when sender is not configured in development.
    """
    subject = "Confirm your SSC account"
    text = (
        f"Hi @{username},\n\n"
        f"Confirm your email to activate your SSC account:\n{verify_url}\n\n"
        "This link expires in 24 hours. If you did not register, ignore this email.\n"
    )
    html = (
        f"<p>Hi <strong>@{username}</strong>,</p>"
        f"<p>Confirm your email to activate your SSC account:</p>"
        f'<p><a href="{verify_url}">Confirm email</a></p>'
        f"<p>Or copy this link:<br><code>{verify_url}</code></p>"
        "<p>This link expires in 24 hours.</p>"
    )

    if _cloudflare_email_configured():
        _send_cloudflare(to_email=to_email, subject=subject, html=html, text=text)
        return None
    if _smtp_configured():
        _send_smtp(to_email=to_email, subject=subject, html=html, text=text)
        return None

    logger.warning("[SSC] email sender not configured — verification link logged only")
    logger.info(f"[SSC] email verification link for {to_email}: {verify_url}")
    if ENV == "development":
        return verify_url
    raise EmailSendError("email_sender_not_configured")