from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from .config import load_config
from .features.cart.handlers import router as cart_router
from .features.menu.handlers import router as menu_router
from .features.menu.state import MenuStateStore
from .storage.db import init_db
from .storage.repos import seed_products
from .utils.throttle import Throttle


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    config = load_config()
    db_path = Path(config.db_path)
    if str(db_path) != ":memory:" and not str(db_path).startswith("file:"):
        db_path.parent.mkdir(parents=True, exist_ok=True)
    await init_db(str(db_path))
    await seed_products(str(db_path))

    bot = Bot(token=config.bot_token, parse_mode=ParseMode.HTML)
    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)
    dp["config"] = config
    dp["menu_state"] = MenuStateStore()
    dp["throttle"] = Throttle(min_interval=0.3)

    dp.include_router(menu_router)
    dp.include_router(cart_router)

    try:
        await dp.start_polling(bot)
    except Exception:
        logging.exception("Bot stopped unexpectedly")
        raise


if __name__ == "__main__":
    asyncio.run(main())
