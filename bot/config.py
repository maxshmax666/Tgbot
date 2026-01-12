from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    bot_token: str
    miniapp_url: str


def load_config() -> Config:
    """Load required configuration from .env and environment variables."""
    load_dotenv()

    bot_token = os.getenv("BOT_TOKEN")
    miniapp_url = os.getenv("MINIAPP_URL")

    if not bot_token:
        raise RuntimeError("BOT_TOKEN must be set")
    if not miniapp_url:
        raise RuntimeError("MINIAPP_URL must be set")

    return Config(
        bot_token=bot_token,
        miniapp_url=miniapp_url,
    )
