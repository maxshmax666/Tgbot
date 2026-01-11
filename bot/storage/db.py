from __future__ import annotations

from datetime import datetime, timezone

import aiosqlite

from .migrations import run_migrations


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init_db(db_path: str) -> None:
    """Initialize SQLite schema for users, products, cart items, and orders."""
    await run_migrations(db_path)


async def ensure_user(db_path: str, tg_id: int) -> int:
    async with aiosqlite.connect(db_path) as conn:
        await conn.execute(
            "INSERT OR IGNORE INTO users (tg_id, created_at) VALUES (?, ?)",
            (tg_id, _utc_now()),
        )
        await conn.commit()
        async with conn.execute("SELECT id FROM users WHERE tg_id = ?", (tg_id,)) as cur:
            row = await cur.fetchone()
        if not row:
            raise RuntimeError("Failed to create or fetch user")
        return int(row[0])
