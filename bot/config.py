from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    bot_token: str
    admin_chat_id: int
    admin_tg_id: int | None
    db_path: str
    webapp_url: str
    yookassa_shop_id: str | None
    yookassa_secret_key: str | None
    yookassa_return_url: str | None
    min_order: int
    work_hours_open: str
    work_hours_close: str
    delivery_fee: int
    free_delivery_from: int
    support_phone: str | None
    support_chat: str | None
    admin_pin_hash: str | None


def load_config() -> Config:
    """Load required configuration from .env and environment variables."""
    load_dotenv()

    bot_token = os.getenv("BOT_TOKEN")
    admin_chat_id = os.getenv("ADMIN_CHAT_ID")
    db_path = os.getenv("DB_PATH")
    admin_tg_id = os.getenv("ADMIN_TG_ID")

    if not bot_token or not admin_chat_id:
        raise RuntimeError("BOT_TOKEN and ADMIN_CHAT_ID must be set")
    if not db_path:
        raise RuntimeError("DB_PATH must be set")

    return Config(
        bot_token=bot_token,
        admin_chat_id=int(admin_chat_id),
        admin_tg_id=int(admin_tg_id) if admin_tg_id else None,
        db_path=db_path,
        webapp_url=os.getenv(
            "WEBAPP_URL",
            "https://tgbot-3cm.pages.dev/",
        ),
        yookassa_shop_id=os.getenv("YOOKASSA_SHOP_ID"),
        yookassa_secret_key=os.getenv("YOOKASSA_SECRET_KEY"),
        yookassa_return_url=os.getenv("YOOKASSA_RETURN_URL"),
        min_order=int(os.getenv("MIN_ORDER", "700")),
        work_hours_open=os.getenv("WORK_HOURS_OPEN", "10:00"),
        work_hours_close=os.getenv("WORK_HOURS_CLOSE", "22:00"),
        delivery_fee=int(os.getenv("DELIVERY_FEE", "0")),
        free_delivery_from=int(os.getenv("FREE_DELIVERY_FROM", "1500")),
        support_phone=os.getenv("SUPPORT_PHONE"),
        support_chat=os.getenv("SUPPORT_CHAT"),
        admin_pin_hash=os.getenv("ADMIN_PIN_HASH"),
    )
