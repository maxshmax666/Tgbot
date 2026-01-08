from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

import aiosqlite


@dataclass(frozen=True)
class CartItem:
    code: str
    name: str
    price: int
    qty: int


@dataclass(frozen=True)
class Order:
    id: int
    user_id: int
    status: str
    delivery_type: str | None
    address: str | None
    desired_time: str | None
    phone: str | None
    payment_method: str | None
    payment_status: str | None
    total_amount: int
    yookassa_payment_id: str | None
    created_at: str
    updated_at: str


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path: str) -> None:
        self._path = path
        self._conn: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        self._conn = await aiosqlite.connect(self._path)
        await self._conn.execute("PRAGMA foreign_keys = ON")
        await self._conn.execute("PRAGMA journal_mode = WAL")
        await self._conn.execute("PRAGMA synchronous = NORMAL")
        await self._conn.commit()

    async def close(self) -> None:
        if self._conn:
            await self._conn.close()

    async def init(self) -> None:
        if not self._conn:
            raise RuntimeError("Database not connected")
        await self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tg_id INTEGER UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                current_order_id INTEGER,
                FOREIGN KEY (current_order_id) REFERENCES orders(id)
            );

            CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                price INTEGER NOT NULL,
                qty INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                delivery_type TEXT,
                address TEXT,
                desired_time TEXT,
                phone TEXT,
                payment_method TEXT,
                payment_status TEXT,
                total_amount INTEGER NOT NULL,
                yookassa_payment_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                price INTEGER NOT NULL,
                qty INTEGER NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            );
            """
        )
        await self._conn.commit()

    async def ensure_user(self, tg_id: int) -> int:
        if not self._conn:
            raise RuntimeError("Database not connected")
        async with self._conn.execute("SELECT id FROM users WHERE tg_id = ?", (tg_id,)) as cur:
            row = await cur.fetchone()
            if row:
                return row[0]
        await self._conn.execute(
            "INSERT INTO users (tg_id, created_at) VALUES (?, ?)",
            (tg_id, _utc_now()),
        )
        await self._conn.commit()
        async with self._conn.execute("SELECT id FROM users WHERE tg_id = ?", (tg_id,)) as cur:
            row = await cur.fetchone()
            if not row:
                raise RuntimeError("Failed to create user")
            return row[0]

    async def add_to_cart(self, user_id: int, code: str, name: str, price: int) -> None:
        if not self._conn:
            raise RuntimeError("Database not connected")
        async with self._conn.execute(
            "SELECT id, qty FROM cart_items WHERE user_id = ? AND code = ?",
            (user_id, code),
        ) as cur:
            row = await cur.fetchone()
        if row:
            item_id, qty = row
            await self._conn.execute(
                "UPDATE cart_items SET qty = ? WHERE id = ?",
                (qty + 1, item_id),
            )
        else:
            await self._conn.execute(
                "INSERT INTO cart_items (user_id, code, name, price, qty, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, code, name, price, 1, _utc_now()),
            )
        await self._conn.commit()

    async def get_cart(self, user_id: int) -> list[CartItem]:
        if not self._conn:
            raise RuntimeError("Database not connected")
        items: list[CartItem] = []
        async with self._conn.execute(
            "SELECT code, name, price, qty FROM cart_items WHERE user_id = ?",
            (user_id,),
        ) as cur:
            async for row in cur:
                items.append(CartItem(code=row[0], name=row[1], price=row[2], qty=row[3]))
        return items

    async def clear_cart(self, user_id: int) -> None:
        if not self._conn:
            raise RuntimeError("Database not connected")
        await self._conn.execute("DELETE FROM cart_items WHERE user_id = ?", (user_id,))
        await self._conn.commit()

    async def create_order_from_cart(self, user_id: int, items: Iterable[CartItem]) -> int:
        if not self._conn:
            raise RuntimeError("Database not connected")
        total = sum(item.price * item.qty for item in items)
        now = _utc_now()
        cur = await self._conn.execute(
            "INSERT INTO orders (user_id, status, total_amount, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (user_id, "draft", total, now, now),
        )
        order_id = cur.lastrowid
        for item in items:
            await self._conn.execute(
                "INSERT INTO order_items (order_id, code, name, price, qty)"
                " VALUES (?, ?, ?, ?, ?)",
                (order_id, item.code, item.name, item.price, item.qty),
            )
        await self._conn.execute(
            "UPDATE users SET current_order_id = ? WHERE id = ?",
            (order_id, user_id),
        )
        await self._conn.commit()
        return int(order_id)

    async def get_current_order(self, user_id: int) -> Order | None:
        if not self._conn:
            raise RuntimeError("Database not connected")
        async with self._conn.execute(
            """
            SELECT o.id, o.user_id, o.status, o.delivery_type, o.address, o.desired_time,
                   o.phone, o.payment_method, o.payment_status, o.total_amount,
                   o.yookassa_payment_id, o.created_at, o.updated_at
            FROM orders o
            JOIN users u ON u.current_order_id = o.id
            WHERE u.id = ?
            """,
            (user_id,),
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return None
        return Order(
            id=row[0],
            user_id=row[1],
            status=row[2],
            delivery_type=row[3],
            address=row[4],
            desired_time=row[5],
            phone=row[6],
            payment_method=row[7],
            payment_status=row[8],
            total_amount=row[9],
            yookassa_payment_id=row[10],
            created_at=row[11],
            updated_at=row[12],
        )

    async def update_order_fields(self, order_id: int, **fields: str | int | None) -> None:
        if not self._conn:
            raise RuntimeError("Database not connected")
        if not fields:
            return
        fields["updated_at"] = _utc_now()
        set_clause = ", ".join(f"{key} = ?" for key in fields)
        values = list(fields.values())
        values.append(order_id)
        await self._conn.execute(f"UPDATE orders SET {set_clause} WHERE id = ?", values)
        await self._conn.commit()

    async def set_current_order(self, user_id: int, order_id: int | None) -> None:
        if not self._conn:
            raise RuntimeError("Database not connected")
        await self._conn.execute(
            "UPDATE users SET current_order_id = ? WHERE id = ?",
            (order_id, user_id),
        )
        await self._conn.commit()

    async def list_recent_orders(self, limit: int = 5) -> list[Order]:
        if not self._conn:
            raise RuntimeError("Database not connected")
        orders: list[Order] = []
        async with self._conn.execute(
            """
            SELECT id, user_id, status, delivery_type, address, desired_time, phone,
                   payment_method, payment_status, total_amount, yookassa_payment_id,
                   created_at, updated_at
            FROM orders
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ) as cur:
            async for row in cur:
                orders.append(
                    Order(
                        id=row[0],
                        user_id=row[1],
                        status=row[2],
                        delivery_type=row[3],
                        address=row[4],
                        desired_time=row[5],
                        phone=row[6],
                        payment_method=row[7],
                        payment_status=row[8],
                        total_amount=row[9],
                        yookassa_payment_id=row[10],
                        created_at=row[11],
                        updated_at=row[12],
                    )
                )
        return orders

    async def get_order_items(self, order_id: int) -> list[CartItem]:
        if not self._conn:
            raise RuntimeError("Database not connected")
        items: list[CartItem] = []
        async with self._conn.execute(
            "SELECT code, name, price, qty FROM order_items WHERE order_id = ?",
            (order_id,),
        ) as cur:
            async for row in cur:
                items.append(CartItem(code=row[0], name=row[1], price=row[2], qty=row[3]))
        return items

    async def get_order(self, order_id: int) -> Order | None:
        if not self._conn:
            raise RuntimeError("Database not connected")
        async with self._conn.execute(
            """
            SELECT id, user_id, status, delivery_type, address, desired_time, phone,
                   payment_method, payment_status, total_amount, yookassa_payment_id,
                   created_at, updated_at
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
            user_id=row[1],
            status=row[2],
            delivery_type=row[3],
            address=row[4],
            desired_time=row[5],
            phone=row[6],
            payment_method=row[7],
            payment_status=row[8],
            total_amount=row[9],
            yookassa_payment_id=row[10],
            created_at=row[11],
            updated_at=row[12],
        )

    async def get_pending_yookassa_orders(self) -> list[Order]:
        if not self._conn:
            raise RuntimeError("Database not connected")
        orders: list[Order] = []
        async with self._conn.execute(
            """
            SELECT id, user_id, status, delivery_type, address, desired_time, phone,
                   payment_method, payment_status, total_amount, yookassa_payment_id,
                   created_at, updated_at
            FROM orders
            WHERE payment_method = 'yookassa' AND payment_status = 'pending'
                  AND yookassa_payment_id IS NOT NULL
            """
        ) as cur:
            async for row in cur:
                orders.append(
                    Order(
                        id=row[0],
                        user_id=row[1],
                        status=row[2],
                        delivery_type=row[3],
                        address=row[4],
                        desired_time=row[5],
                        phone=row[6],
                        payment_method=row[7],
                        payment_status=row[8],
                        total_amount=row[9],
                        yookassa_payment_id=row[10],
                        created_at=row[11],
                        updated_at=row[12],
                    )
                )
        return orders
