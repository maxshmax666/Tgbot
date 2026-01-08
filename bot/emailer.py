from __future__ import annotations

from email.message import EmailMessage

import aiosmtplib

from .config import Config


async def send_admin_email(config: Config, subject: str, body: str) -> None:
    if not (config.admin_email and config.smtp_host and config.smtp_user and config.smtp_password):
        return

    message = EmailMessage()
    message["From"] = config.smtp_user
    message["To"] = config.admin_email
    message["Subject"] = subject
    message.set_content(body)

    await aiosmtplib.send(
        message,
        hostname=config.smtp_host,
        port=config.smtp_port,
        username=config.smtp_user,
        password=config.smtp_password,
        start_tls=config.smtp_tls,
    )
