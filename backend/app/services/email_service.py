"""Optional SMTP for password-reset emails (stdlib only)."""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

from flask import Flask


def send_password_reset_email(app: Flask, to_email: str, reset_token: str) -> bool:
    """
    Send reset link if MAIL_SERVER is configured. Returns True if send attempted OK.
    """
    server = app.config.get("MAIL_SERVER") or ""
    if not server:
        return False

    sender = app.config.get("MAIL_DEFAULT_SENDER") or app.config.get("MAIL_USERNAME")
    if not sender:
        app.logger.warning("MAIL_DEFAULT_SENDER or MAIL_USERNAME required to send email")
        return False

    base = app.config.get("PASSWORD_RESET_FRONTEND_URL") or ""
    if base:
        link = f"{base}?token={reset_token}"
        body = (
            "You requested a password reset for your MRV account.\n\n"
            f"Open this link (valid for a limited time):\n{link}\n\n"
            "If you did not request this, ignore this email."
        )
    else:
        body = (
            "You requested a password reset for your MRV account.\n\n"
            "Use this token in the reset form:\n\n"
            f"{reset_token}\n\n"
            "If you did not request this, ignore this email."
        )

    msg = EmailMessage()
    msg["Subject"] = "Password reset — MRV"
    msg["From"] = sender
    msg["To"] = to_email
    msg.set_content(body)

    port = int(app.config.get("MAIL_PORT") or 587)
    use_tls = bool(app.config.get("MAIL_USE_TLS"))
    user = app.config.get("MAIL_USERNAME") or ""
    password = app.config.get("MAIL_PASSWORD") or ""

    with smtplib.SMTP(server, port, timeout=30) as smtp:
        if use_tls:
            smtp.starttls()
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)

    return True
