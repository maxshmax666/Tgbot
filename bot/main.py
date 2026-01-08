from __future__ import annotations

import asyncio
import logging
import os

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from dotenv import load_dotenv

from .config import load_config
from .db import Database
from .handlers import router, yookassa_poller


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    load_dotenv()
    config = load_config()
    bot = Bot(token=config.bot_token, parse_mode=ParseMode.HTML)
    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)
    db_path = os.getenv("DB_PATH", "bot.db")
    db = Database(db_path)

    await db.connect()
    await db.init()

    dp["db"] = db
    dp["config"] = config

    dp.include_router(router)

    poller_task = asyncio.create_task(yookassa_poller(bot, db, config))
    try:
        await dp.start_polling(bot)
    finally:
        poller_task.cancel()
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
