from __future__ import annotations

import os
from dataclasses import dataclass


def _get_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(frozen=True)
class Config:
    bot_token: str
    admin_chat_id: int
    admin_email: str | None
    smtp_host: str | None
    smtp_port: int
    smtp_user: str | None
    smtp_password: str | None
    smtp_tls: bool
    telegram_provider_token: str | None
    yookassa_shop_id: str | None
    yookassa_secret_key: str | None
    yookassa_return_url: str | None
    qr_payload: str | None
    currency: str
    timezone: str


def load_config() -> Config:
    bot_token = os.getenv("BOT_TOKEN")
    admin_chat_id = os.getenv("ADMIN_CHAT_ID")
    if not bot_token or not admin_chat_id:
        raise RuntimeError("BOT_TOKEN and ADMIN_CHAT_ID must be set")

    return Config(
        bot_token=bot_token,
        admin_chat_id=int(admin_chat_id),
        admin_email=os.getenv("ADMIN_EMAIL"),
        smtp_host=os.getenv("SMTP_HOST"),
        smtp_port=int(os.getenv("SMTP_PORT", "587")),
        smtp_user=os.getenv("SMTP_USER"),
        smtp_password=os.getenv("SMTP_PASSWORD"),
        smtp_tls=_get_bool(os.getenv("SMTP_TLS"), default=True),
        telegram_provider_token=os.getenv("TELEGRAM_PROVIDER_TOKEN"),
        yookassa_shop_id=os.getenv("YOOKASSA_SHOP_ID"),
        yookassa_secret_key=os.getenv("YOOKASSA_SECRET_KEY"),
        yookassa_return_url=os.getenv("YOOKASSA_RETURN_URL"),
        qr_payload=os.getenv("QR_PAYLOAD"),
        currency=os.getenv("PAYMENT_CURRENCY", "RUB"),
        timezone=os.getenv("BOT_TIMEZONE", "Europe/Moscow"),
    )
