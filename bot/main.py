from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

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
    env_db_path = os.getenv("DB_PATH")
    default_db_path = Path(__file__).resolve().parent.parent / "bot.db"
    db_path = Path(env_db_path) if env_db_path else default_db_path
    db_path_str = str(db_path)
    if db_path_str != ":memory:" and not db_path_str.startswith("file:"):
        db_path.parent.mkdir(parents=True, exist_ok=True)
    db = Database(str(db_path))

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
