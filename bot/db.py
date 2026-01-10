from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

import aiosqlite


@dataclass(frozen=True)
class CartItem:
    pizza_code: str
    title: str
    price: int
    qty: int


@dataclass(frozen=True)
class Order:
    id: int
    tg_id: int
    status: str
    total: int
    payment_method: str | None
    payment_id: str | None
    created_at: str


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init_db(db_path: str) -> None:
    """Initialize SQLite schema for users, cart items, and orders."""
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

            CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY,
                tg_id INTEGER,
                pizza_code TEXT,
                title TEXT,
                price INTEGER,
                qty INTEGER,
                created_at TEXT
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


async def ensure_user(db_path: str, tg_id: int) -> None:
    """Create user row if missing."""
    async with aiosqlite.connect(db_path) as conn:
        await conn.execute(
            "INSERT OR IGNORE INTO users (tg_id, created_at) VALUES (?, ?)",
            (tg_id, _utc_now()),
        )
        await conn.commit()


async def cart_add(
    db_path: str,
    tg_id: int,
    pizza_code: str,
    title: str,
    price: int,
    qty: int = 1,
) -> None:
    """Add item to cart or increment quantity."""
    await ensure_user(db_path, tg_id)
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            "SELECT id, qty FROM cart_items WHERE tg_id = ? AND pizza_code = ?",
            (tg_id, pizza_code),
        ) as cur:
            row = await cur.fetchone()
        if row:
            item_id, current_qty = row
            await conn.execute(
                "UPDATE cart_items SET qty = ? WHERE id = ?",
                (current_qty + qty, item_id),
            )
        else:
            await conn.execute(
                "INSERT INTO cart_items (tg_id, pizza_code, title, price, qty, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (tg_id, pizza_code, title, price, qty, _utc_now()),
            )
        await conn.commit()


async def cart_get(db_path: str, tg_id: int) -> list[CartItem]:
    async with aiosqlite.connect(db_path) as conn:
        items: list[CartItem] = []
        async with conn.execute(
            "SELECT pizza_code, title, price, qty FROM cart_items WHERE tg_id = ?",
            (tg_id,),
        ) as cur:
            async for row in cur:
                items.append(CartItem(pizza_code=row[0], title=row[1], price=row[2], qty=row[3]))
        return items


async def cart_clear(db_path: str, tg_id: int) -> None:
    async with aiosqlite.connect(db_path) as conn:
        await conn.execute("DELETE FROM cart_items WHERE tg_id = ?", (tg_id,))
        await conn.commit()


async def cart_total(db_path: str, tg_id: int) -> int:
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            "SELECT COALESCE(SUM(price * qty), 0) FROM cart_items WHERE tg_id = ?",
            (tg_id,),
        ) as cur:
            row = await cur.fetchone()
            return int(row[0]) if row else 0


async def order_create(db_path: str, tg_id: int, total: int, payment_method: str) -> int:
    async with aiosqlite.connect(db_path) as conn:
        cur = await conn.execute(
            "INSERT INTO orders (tg_id, status, total, payment_method, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (tg_id, "pending_payment", total, payment_method, _utc_now()),
        )
        await conn.commit()
        return int(cur.lastrowid)


async def order_set_payment(db_path: str, order_id: int, payment_id: str) -> None:
    async with aiosqlite.connect(db_path) as conn:
        await conn.execute(
            "UPDATE orders SET payment_id = ? WHERE id = ?",
            (payment_id, order_id),
        )
        await conn.commit()


async def order_set_status(db_path: str, order_id: int, status: str) -> None:
    async with aiosqlite.connect(db_path) as conn:
        await conn.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
        await conn.commit()


async def order_get_latest(db_path: str, tg_id: int) -> Order | None:
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            """
            SELECT id, tg_id, status, total, payment_method, payment_id, created_at
            FROM orders
            WHERE tg_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (tg_id,),
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return None
        return Order(
            id=row[0],
            tg_id=row[1],
            status=row[2],
            total=row[3],
            payment_method=row[4],
            payment_id=row[5],
            created_at=row[6],
        )


async def order_get_by_id(db_path: str, order_id: int) -> Order | None:
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            """
            SELECT id, tg_id, status, total, payment_method, payment_id, created_at
            FROM orders
            WHERE id = ?
            """,
            (order_id,),
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return None
        return Order(
            id=row[0],
            tg_id=row[1],
            status=row[2],
            total=row[3],
            payment_method=row[4],
            payment_id=row[5],
            created_at=row[6],
        )


async def cart_snapshot(db_path: str, tg_id: int) -> tuple[list[CartItem], int]:
    items = await cart_get(db_path, tg_id)
    total = sum(item.price * item.qty for item in items)
    return items, total
