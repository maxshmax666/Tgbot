from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    bot_token: str
    admin_chat_id: int
    db_path: str
    webapp_url: str
    yookassa_shop_id: str | None
    yookassa_secret_key: str | None
    yookassa_return_url: str | None


def load_config() -> Config:
    """Load required configuration from .env and environment variables."""
    load_dotenv()

    bot_token = os.getenv("BOT_TOKEN")
    admin_chat_id = os.getenv("ADMIN_CHAT_ID")
    db_path = os.getenv("DB_PATH")

    if not bot_token or not admin_chat_id:
        raise RuntimeError("BOT_TOKEN and ADMIN_CHAT_ID must be set")
    if not db_path:
        raise RuntimeError("DB_PATH must be set")

    return Config(
        bot_token=bot_token,
        admin_chat_id=int(admin_chat_id),
        db_path=db_path,
        webapp_url=os.getenv("WEBAPP_URL", "https://example.com"),
        yookassa_shop_id=os.getenv("YOOKASSA_SHOP_ID"),
        yookassa_secret_key=os.getenv("YOOKASSA_SECRET_KEY"),
        yookassa_return_url=os.getenv("YOOKASSA_RETURN_URL"),
    )
