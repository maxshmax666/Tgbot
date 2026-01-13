from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from bot.storage.repos import Category


def menu_keyboard(
    cart_qty: int,
    show_photo_nav: bool,
    show_reset: bool,
    can_decrement: bool,
    product_id: int,
    webapp_url: str,
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [
        [
            InlineKeyboardButton(text="⬅️", callback_data="m:i:prev"),
            InlineKeyboardButton(text="➡️", callback_data="m:i:next"),
        ]
    ]

    if show_photo_nav:
        rows.append(
            [
                InlineKeyboardButton(text="📷 Фото ⬅️", callback_data="m:p:prev"),
                InlineKeyboardButton(text="Фото ➡️", callback_data="m:p:next"),
            ]
        )

    rows.append(
        [
            InlineKeyboardButton(text="➕ В корзину", callback_data="m:add"),
            InlineKeyboardButton(
                text="➖ Убрать" if can_decrement else "➖ Убрать (0)",
                callback_data=f"c:dec:{product_id}",
            ),
        ]
    )

    rows.append(
        [
            InlineKeyboardButton(text=f"🧾 Корзина ({cart_qty})", callback_data="c:open"),
        ]
    )

    rows.append(
        [
            InlineKeyboardButton(
                text="🍕 Открыть магазин (внутри Telegram)",
                web_app=WebAppInfo(url=webapp_url),
            )
        ]
    )

    rows.append(
        [
            InlineKeyboardButton(text="ℹ️ Подробнее", callback_data="m:info"),
            InlineKeyboardButton(text="🔎 Поиск", callback_data="m:search"),
        ]
    )

    rows.append([InlineKeyboardButton(text="📂 Категории", callback_data="m:cat")])

    if show_reset:
        rows.append([InlineKeyboardButton(text="❌ Сбросить фильтры", callback_data="m:reset")])

    return InlineKeyboardMarkup(inline_keyboard=rows)


def categories_keyboard(categories: list[Category], active: str | None) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for category in categories:
        prefix = "✅ " if category.code == active else ""
        rows.append(
            [
                InlineKeyboardButton(
                    text=f"{prefix}{category.title}",
                    callback_data=f"m:cat:{category.code}",
                )
            ]
        )
    rows.append([InlineKeyboardButton(text="⬅️ Назад", callback_data="m:cat")])
    return InlineKeyboardMarkup(inline_keyboard=rows)
