from __future__ import annotations

import asyncio
import logging

from aiogram import Bot, Dispatcher, Router
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message

from .config import load_config


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    config = load_config()

    bot = Bot(token=config.bot_token, parse_mode=ParseMode.HTML)
    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)
    router = Router()

    async def send_miniapp(message: Message) -> None:
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="Открыть Mini App", url=config.miniapp_url)],
            ]
        )
        await message.answer(
            "Откройте Mini App по кнопке ниже.",
            reply_markup=keyboard,
        )

    @router.message(CommandStart())
    async def handle_start(message: Message) -> None:
        await send_miniapp(message)

    @router.message(Command("app"))
    async def handle_app(message: Message) -> None:
        await send_miniapp(message)

    dp.include_router(router)

    try:
        await dp.start_polling(bot)
    except Exception:
        logging.exception("Bot stopped unexpectedly")
        raise


if __name__ == "__main__":
    asyncio.run(main())
