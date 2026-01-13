from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass
from typing import Final

from dotenv import load_dotenv

_TRUE_VALUES: Final[set[str]] = {"1", "true", "yes", "y", "on"}
_FALSE_VALUES: Final[set[str]] = {"0", "false", "no", "n", "off"}


@dataclass(frozen=True)
class Config:
    bot_token: str
    miniapp_url: str
    db_path: str
    webapp_url: str
    admin_chat_id: int
    yookassa_shop_id: str | None
    yookassa_secret_key: str | None
    yookassa_return_url: str | None
    admin_email: str | None
    smtp_host: str | None
    smtp_port: int
    smtp_user: str | None
    smtp_password: str | None
    smtp_tls: bool


def _parse_int(value: str | None, name: str, default: int | None = None) -> int:
    if value is None or value == "":
        if default is None:
            raise RuntimeError(f"{name} must be set")
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc


def _parse_bool(value: str | None, name: str, default: bool) -> bool:
    if value is None or value == "":
        return default
    normalized = value.strip().lower()
    if normalized in _TRUE_VALUES:
        return True
    if normalized in _FALSE_VALUES:
        return False
    raise RuntimeError(f"{name} must be a boolean (true/false)")


def load_config() -> Config:
    """Load required configuration from .env and environment variables."""
    repo_root = Path(__file__).resolve().parents[1]
    env_path = repo_root / ".env"
    example_env_path = repo_root / ".env.example"

    if env_path.exists():
        load_dotenv(env_path)
    elif example_env_path.exists():
        load_dotenv(example_env_path)

    bot_token = os.getenv("BOT_TOKEN")
    miniapp_url = os.getenv("MINIAPP_URL")
    db_path = os.getenv("DB_PATH") or str(repo_root / "bot.db")
    webapp_url = os.getenv("WEBAPP_URL") or miniapp_url
    admin_chat_id = _parse_int(os.getenv("ADMIN_CHAT_ID"), "ADMIN_CHAT_ID")
    yookassa_shop_id = os.getenv("YOOKASSA_SHOP_ID") or None
    yookassa_secret_key = os.getenv("YOOKASSA_SECRET_KEY") or None
    yookassa_return_url = os.getenv("YOOKASSA_RETURN_URL") or None
    admin_email = os.getenv("ADMIN_EMAIL") or None
    smtp_host = os.getenv("SMTP_HOST") or None
    smtp_port = _parse_int(os.getenv("SMTP_PORT"), "SMTP_PORT", default=587)
    smtp_user = os.getenv("SMTP_USER") or None
    smtp_password = os.getenv("SMTP_PASSWORD") or None
    smtp_tls = _parse_bool(os.getenv("SMTP_TLS"), "SMTP_TLS", default=True)

    if not bot_token:
        raise RuntimeError("BOT_TOKEN must be set")
    if not miniapp_url:
        raise RuntimeError("MINIAPP_URL must be set")
    if not webapp_url:
        raise RuntimeError("WEBAPP_URL must be set")
    if not db_path:
        raise RuntimeError("DB_PATH must be set")

    return Config(
        bot_token=bot_token,
        miniapp_url=miniapp_url,
        db_path=db_path,
        webapp_url=webapp_url,
        admin_chat_id=admin_chat_id,
        yookassa_shop_id=yookassa_shop_id,
        yookassa_secret_key=yookassa_secret_key,
        yookassa_return_url=yookassa_return_url,
        admin_email=admin_email,
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_user=smtp_user,
        smtp_password=smtp_password,
        smtp_tls=smtp_tls,
    )
