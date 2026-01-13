from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import aiosqlite

from .db import ensure_user


@dataclass(frozen=True)
class Product:
    id: int
    code: str
    title: str
    description: str | None
    details: str | None
    price: int
    category: str | None
    category_title: str | None
    photo_dir: str | None
    is_popular: bool
    is_new: bool


@dataclass(frozen=True)
class CartItem:
    product_id: int
    title: str
    price: int
    qty: int


@dataclass(frozen=True)
class Order:
    id: int
    order_id: str | None
    tg_id: int
    username: str | None
    phone: str | None
    name: str | None
    delivery_type: str | None
    address: str | None
    status: str
    total: int
    payment_method: str | None
    payment_id: str | None
    created_at: str


@dataclass(frozen=True)
class Category:
    code: str
    title: str


@dataclass(frozen=True)
class OrderItemInput:
    item_id: str | None
    title: str
    qty: int
    price: int
    subtotal: int


SEED_PRODUCTS: tuple[dict[str, object], ...] = (
    {
        "code": "margarita",
        "title": "Маргарита",
        "description": "Томатный соус, моцарелла, базилик",
        "details": "Классическая итальянская пицца, 30 см, 520 г.",
        "price": 450,
        "category": "pizza",
        "category_title": "Пицца",
        "photo_dir": "margarita",
        "is_popular": True,
        "is_new": False,
    },
    {
        "code": "four_cheese",
        "title": "Четыре сыра",
        "description": "Моцарелла, пармезан, дорблю, чеддер",
        "details": "Насыщенная сырная пицца, 30 см, 540 г.",
        "price": 520,
        "category": "pizza",
        "category_title": "Пицца",
        "photo_dir": "4chees",
        "is_popular": True,
        "is_new": False,
    },
    {
        "code": "cheese_bacon",
        "title": "Сырная с беконом",
        "description": "Бекон, моцарелла, сливочный соус",
        "details": "Сытная пицца с беконом, 30 см, 580 г.",
        "price": 560,
        "category": "pizza",
        "category_title": "Пицца",
        "photo_dir": "beacon",
        "is_popular": False,
        "is_new": False,
    },
    {
        "code": "sausage",
        "title": "С колбасой",
        "description": "Колбаски, моцарелла, томатный соус",
        "details": "Пикантная колбаса, 30 см, 560 г.",
        "price": 500,
        "category": "pizza",
        "category_title": "Пицца",
        "photo_dir": "kolbasa",
        "is_popular": False,
        "is_new": False,
    },
    {
        "code": "meat",
        "title": "Мясная",
        "description": "Ветчина, салями, бекон, моцарелла",
        "details": "Для любителей мяса, 30 см, 610 г.",
        "price": 590,
        "category": "pizza",
        "category_title": "Пицца",
        "photo_dir": "myasnaya",
        "is_popular": False,
        "is_new": True,
    },
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed_products(db_path: str) -> None:
    async with aiosqlite.connect(db_path) as conn:
        for product in SEED_PRODUCTS:
            await conn.execute(
                """
                INSERT INTO products (
                    code, title, description, details, price, category, category_title,
                    photo_dir, is_popular, is_new, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(code) DO UPDATE SET
                    title = excluded.title,
                    description = excluded.description,
                    details = excluded.details,
                    price = excluded.price,
                    category = excluded.category,
                    category_title = excluded.category_title,
                    photo_dir = excluded.photo_dir,
                    is_popular = excluded.is_popular,
                    is_new = excluded.is_new
                """,
                (
                    product["code"],
                    product["title"],
                    product["description"],
                    product["details"],
                    product["price"],
                    product["category"],
                    product["category_title"],
                    product["photo_dir"],
                    int(bool(product["is_popular"])),
                    int(bool(product["is_new"])),
                    _utc_now(),
                ),
            )
        await conn.commit()


async def get_products(
    db_path: str,
    category: str | None = None,
    search: str | None = None,
) -> list[Product]:
    query = (
        "SELECT id, code, title, description, details, price, category, category_title, "
        "photo_dir, is_popular, is_new FROM products"
    )
    filters: list[str] = []
    params: list[object] = []

    if category:
        filters.append("category = ?")
        params.append(category)
    if search:
        pattern = f"%{search.lower()}%"
        filters.append(
            "(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(details) LIKE ?)"
        )
        params.extend([pattern, pattern, pattern])

    if filters:
        query += " WHERE " + " AND ".join(filters)
    query += " ORDER BY id"

    async with aiosqlite.connect(db_path) as conn:
        items: list[Product] = []
        async with conn.execute(query, params) as cur:
            async for row in cur:
                items.append(
                    Product(
                        id=row[0],
                        code=row[1],
                        title=row[2],
                        description=row[3],
                        details=row[4],
                        price=row[5],
                        category=row[6],
                        category_title=row[7],
                        photo_dir=row[8],
                        is_popular=bool(row[9]),
                        is_new=bool(row[10]),
                    )
                )
        return items


async def get_product_by_id(db_path: str, product_id: int) -> Product | None:
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            """
            SELECT id, code, title, description, details, price, category, category_title,
                   photo_dir, is_popular, is_new
            FROM products
            WHERE id = ?
            """,
            (product_id,),
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return None
        return Product(
            id=row[0],
            code=row[1],
            title=row[2],
            description=row[3],
            details=row[4],
            price=row[5],
            category=row[6],
            category_title=row[7],
            photo_dir=row[8],
            is_popular=bool(row[9]),
            is_new=bool(row[10]),
        )


async def get_product_by_code(db_path: str, code: str) -> Product | None:
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            """
            SELECT id, code, title, description, details, price, category, category_title,
                   photo_dir, is_popular, is_new
            FROM products
            WHERE code = ?
            """,
            (code,),
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return None
        return Product(
            id=row[0],
            code=row[1],
            title=row[2],
            description=row[3],
            details=row[4],
            price=row[5],
            category=row[6],
            category_title=row[7],
            photo_dir=row[8],
            is_popular=bool(row[9]),
            is_new=bool(row[10]),
        )


async def get_categories(db_path: str) -> list[Category]:
    async with aiosqlite.connect(db_path) as conn:
        categories: list[Category] = []
        async with conn.execute(
            """
            SELECT DISTINCT category, category_title
            FROM products
            WHERE category IS NOT NULL
            ORDER BY category_title
            """
        ) as cur:
            async for row in cur:
                categories.append(Category(code=row[0], title=row[1] or row[0]))
        return categories


async def cart_add(db_path: str, tg_id: int, product_id: int, qty: int = 1) -> int:
    user_id = await ensure_user(db_path, tg_id)
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            "SELECT qty FROM cart_items WHERE user_id = ? AND product_id = ?",
            (user_id, product_id),
        ) as cur:
            row = await cur.fetchone()
        if row:
            new_qty = int(row[0]) + qty
            await conn.execute(
                "UPDATE cart_items SET qty = ? WHERE user_id = ? AND product_id = ?",
                (new_qty, user_id, product_id),
            )
        else:
            new_qty = qty
            await conn.execute(
                "INSERT INTO cart_items (user_id, product_id, qty, added_at) VALUES (?, ?, ?, ?)",
                (user_id, product_id, qty, _utc_now()),
            )
        await conn.commit()
        return new_qty


async def cart_decrement(db_path: str, tg_id: int, product_id: int) -> int:
    user_id = await ensure_user(db_path, tg_id)
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            "SELECT qty FROM cart_items WHERE user_id = ? AND product_id = ?",
            (user_id, product_id),
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return 0
        current_qty = int(row[0])
        new_qty = current_qty - 1
        if new_qty <= 0:
            await conn.execute(
                "DELETE FROM cart_items WHERE user_id = ? AND product_id = ?",
                (user_id, product_id),
            )
            await conn.commit()
            return 0
        await conn.execute(
            "UPDATE cart_items SET qty = ? WHERE user_id = ? AND product_id = ?",
            (new_qty, user_id, product_id),
        )
        await conn.commit()
        return new_qty


async def cart_get_items(db_path: str, tg_id: int) -> list[CartItem]:
    user_id = await ensure_user(db_path, tg_id)
    async with aiosqlite.connect(db_path) as conn:
        items: list[CartItem] = []
        async with conn.execute(
            """
            SELECT p.id, p.title, p.price, ci.qty
            FROM cart_items ci
            JOIN products p ON p.id = ci.product_id
            WHERE ci.user_id = ?
            ORDER BY p.title
            """,
            (user_id,),
        ) as cur:
            async for row in cur:
                items.append(CartItem(product_id=row[0], title=row[1], price=row[2], qty=row[3]))
        return items


async def cart_clear(db_path: str, tg_id: int) -> None:
    user_id = await ensure_user(db_path, tg_id)
    async with aiosqlite.connect(db_path) as conn:
        await conn.execute("DELETE FROM cart_items WHERE user_id = ?", (user_id,))
        await conn.commit()


async def cart_total_qty(db_path: str, tg_id: int) -> int:
    user_id = await ensure_user(db_path, tg_id)
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            "SELECT COALESCE(SUM(qty), 0) FROM cart_items WHERE user_id = ?",
            (user_id,),
        ) as cur:
            row = await cur.fetchone()
        return int(row[0]) if row else 0


async def cart_total_price(db_path: str, tg_id: int) -> int:
    user_id = await ensure_user(db_path, tg_id)
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            """
            SELECT COALESCE(SUM(ci.qty * p.price), 0)
            FROM cart_items ci
            JOIN products p ON p.id = ci.product_id
            WHERE ci.user_id = ?
            """,
            (user_id,),
        ) as cur:
            row = await cur.fetchone()
        return int(row[0]) if row else 0


async def cart_item_qty(db_path: str, tg_id: int, product_id: int) -> int:
    user_id = await ensure_user(db_path, tg_id)
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            "SELECT qty FROM cart_items WHERE user_id = ? AND product_id = ?",
            (user_id, product_id),
        ) as cur:
            row = await cur.fetchone()
        return int(row[0]) if row else 0


async def order_create(db_path: str, tg_id: int, total: int, payment_method: str) -> int:
    user_id = await ensure_user(db_path, tg_id)
    async with aiosqlite.connect(db_path) as conn:
        cur = await conn.execute(
            "INSERT INTO orders (tg_id, user_id, status, total, payment_method, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (tg_id, user_id, "pending_payment", total, payment_method, _utc_now()),
        )
        await conn.commit()
        return int(cur.lastrowid)


async def order_create_with_items(
    db_path: str,
    tg_id: int,
    total: int,
    status: str,
    payment_method: str | None,
    items: list[OrderItemInput],
    order_id: str | None = None,
    username: str | None = None,
    phone: str | None = None,
    name: str | None = None,
    delivery_type: str | None = None,
    address: str | None = None,
) -> int:
    if not items:
        raise ValueError("Order must contain at least one item")
    user_id = await ensure_user(db_path, tg_id)
    created_at = _utc_now()
    async with aiosqlite.connect(db_path) as conn:
        cur = await conn.execute(
            """
            INSERT INTO orders (
                order_id, tg_id, user_id, username, phone, name,
                delivery_type, address, status, total, payment_method, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                order_id,
                tg_id,
                user_id,
                username,
                phone,
                name,
                delivery_type,
                address,
                status,
                total,
                payment_method,
                created_at,
            ),
        )
        order_id = int(cur.lastrowid)
        await conn.executemany(
            """
            INSERT INTO order_items (order_id, item_id, title, qty, price, subtotal, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (order_id, item.item_id, item.title, item.qty, item.price, item.subtotal, created_at)
                for item in items
            ],
        )
        await conn.commit()
        return order_id


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


async def order_set_status_by_order_id(db_path: str, order_id: str, status: str) -> None:
    async with aiosqlite.connect(db_path) as conn:
        await conn.execute("UPDATE orders SET status = ? WHERE order_id = ?", (status, order_id))
        await conn.commit()


async def order_get_latest(db_path: str, tg_id: int) -> Order | None:
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute(
            """
            SELECT id, order_id, tg_id, username, phone, name, delivery_type, address,
                   status, total, payment_method, payment_id, created_at
            FROM orders
            WHERE tg_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (tg_id,),
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return None
        return Order(
            id=row[0],
            order_id=row[1],
            tg_id=row[2],
            username=row[3],
            phone=row[4],
            name=row[5],
            delivery_type=row[6],
            address=row[7],
            status=row[8],
            total=row[9],
            payment_method=row[10],
            payment_id=row[11],
            created_at=row[12],
        )


async def cart_snapshot(db_path: str, tg_id: int) -> tuple[list[CartItem], int]:
    items = await cart_get_items(db_path, tg_id)
    total = sum(item.price * item.qty for item in items)
    return items, total


async def order_exists_by_order_id(db_path: str, order_id: str) -> bool:
    async with aiosqlite.connect(db_path) as conn:
        async with conn.execute("SELECT 1 FROM orders WHERE order_id = ? LIMIT 1", (order_id,)) as cur:
            row = await cur.fetchone()
        return row is not None


async def order_create_webapp(
    db_path: str,
    tg_id: int,
    username: str | None,
    order_id: str,
    phone: str,
    name: str | None,
    delivery_type: str,
    address: str | None,
    payment_method: str,
    total: int,
    status: str,
    items: list[OrderItemInput],
) -> int:
    return await order_create_with_items(
        db_path=db_path,
        tg_id=tg_id,
        total=total,
        status=status,
        payment_method=payment_method,
        items=items,
        order_id=order_id,
        username=username,
        phone=phone,
        name=name,
        delivery_type=delivery_type,
        address=address,
    )


async def admin_payload_upsert(db_path: str, payload_type: str, payload: str) -> None:
    updated_at = _utc_now()
    async with aiosqlite.connect(db_path) as conn:
        await conn.execute(
            """
            INSERT INTO admin_payloads (type, payload, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(type) DO UPDATE SET
                payload = excluded.payload,
                updated_at = excluded.updated_at
            """,
            (payload_type, payload, updated_at),
        )
        await conn.commit()
