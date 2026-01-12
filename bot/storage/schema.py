from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class IndexDef:
    name: str
    columns: tuple[str, ...]
    unique: bool = False


@dataclass(frozen=True)
class TableDef:
    columns: dict[str, str]
    constraints: tuple[str, ...] = ()
    indexes: tuple[IndexDef, ...] = ()


SCHEMA_VERSION = 3

SCHEMA: dict[str, TableDef] = {
    "users": TableDef(
        columns={
            "id": "INTEGER PRIMARY KEY",
            "tg_id": "INTEGER UNIQUE",
            "created_at": "TEXT",
        },
        indexes=(
            IndexDef(name="idx_users_tg_id", columns=("tg_id",), unique=True),
        ),
    ),
    "products": TableDef(
        columns={
            "id": "INTEGER PRIMARY KEY",
            "code": "TEXT UNIQUE",
            "title": "TEXT",
            "description": "TEXT",
            "details": "TEXT",
            "price": "INTEGER",
            "category": "TEXT",
            "category_title": "TEXT",
            "photo_dir": "TEXT",
            "is_popular": "INTEGER DEFAULT 0",
            "is_new": "INTEGER DEFAULT 0",
            "created_at": "TEXT",
        },
        indexes=(
            IndexDef(name="idx_products_code", columns=("code",), unique=True),
            IndexDef(name="idx_products_category", columns=("category",)),
        ),
    ),
    "cart_items": TableDef(
        columns={
            "id": "INTEGER PRIMARY KEY",
            "user_id": "INTEGER REFERENCES users(id) ON DELETE CASCADE",
            "product_id": "INTEGER REFERENCES products(id) ON DELETE CASCADE",
            "qty": "INTEGER",
            "added_at": "TEXT",
        },
        constraints=("UNIQUE(user_id, product_id)",),
        indexes=(
            IndexDef(name="idx_cart_items_user_id", columns=("user_id",)),
            IndexDef(name="idx_cart_items_product_id", columns=("product_id",)),
            IndexDef(
                name="idx_cart_items_user_product",
                columns=("user_id", "product_id"),
                unique=True,
            ),
        ),
    ),
    "orders": TableDef(
        columns={
            "id": "INTEGER PRIMARY KEY",
            "order_id": "TEXT",
            "tg_id": "INTEGER",
            "user_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
            "username": "TEXT",
            "phone": "TEXT",
            "name": "TEXT",
            "delivery_type": "TEXT",
            "address": "TEXT",
            "status": "TEXT",
            "total": "INTEGER",
            "payment_method": "TEXT",
            "payment_id": "TEXT",
            "created_at": "TEXT",
        },
        indexes=(
            IndexDef(name="idx_orders_order_id", columns=("order_id",), unique=True),
            IndexDef(name="idx_orders_tg_id", columns=("tg_id",)),
            IndexDef(name="idx_orders_status", columns=("status",)),
            IndexDef(name="idx_orders_user_id", columns=("user_id",)),
        ),
    ),
    "order_items": TableDef(
        columns={
            "id": "INTEGER PRIMARY KEY",
            "order_id": "INTEGER REFERENCES orders(id) ON DELETE CASCADE",
            "item_id": "TEXT",
            "title": "TEXT",
            "qty": "INTEGER",
            "price": "INTEGER",
            "subtotal": "INTEGER",
            "created_at": "TEXT",
        },
        indexes=(
            IndexDef(name="idx_order_items_order_id", columns=("order_id",)),
        ),
    ),
    "admin_payloads": TableDef(
        columns={
            "type": "TEXT PRIMARY KEY",
            "payload": "TEXT",
            "updated_at": "TEXT",
        },
    ),
}
