from __future__ import annotations

from datetime import datetime, timezone

import aiosqlite


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init_db(db_path: str) -> None:
    """Initialize SQLite schema for users, products, cart items, and orders."""
    async with aiosqlite.connect(db_path) as conn:
        await conn.execute("PRAGMA foreign_keys = ON")
        await conn.execute("PRAGMA journal_mode = WAL")
        await conn.execute("PRAGMA synchronous = NORMAL")
        await conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                tg_id INTEGER UNIQUE,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY,
                code TEXT UNIQUE,
                title TEXT,
                description TEXT,
                details TEXT,
                price INTEGER,
                category TEXT,
                category_title TEXT,
                photo_dir TEXT,
                is_popular INTEGER DEFAULT 0,
                is_new INTEGER DEFAULT 0,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                qty INTEGER,
                added_at TEXT,
                UNIQUE(user_id, product_id)
            );

            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY,
                tg_id INTEGER,
                status TEXT,
                total INTEGER,
                payment_method TEXT,
                payment_id TEXT,
                created_at TEXT
            );
            """
        )
        await conn.commit()


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
