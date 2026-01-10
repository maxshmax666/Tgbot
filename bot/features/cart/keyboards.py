from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from bot.storage.repos import CartItem


def cart_keyboard(items: list[CartItem]) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for item in items:
        rows.append(
            [
                InlineKeyboardButton(
                    text=f"➖ {item.title}",
                    callback_data=f"c:dec:{item.product_id}",
                ),
                InlineKeyboardButton(text="➕", callback_data=f"c:inc:{item.product_id}"),
            ]
        )
    rows.append([InlineKeyboardButton(text="✅ Оформить", callback_data="c:checkout")])
    rows.append([InlineKeyboardButton(text="🧹 Очистить", callback_data="c:clear")])
    rows.append([InlineKeyboardButton(text="⬅️ Назад в меню", callback_data="c:back")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def payment_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="💳 Карта", callback_data="pay:card")],
            [InlineKeyboardButton(text="🔳 СБП QR", callback_data="pay:sbp")],
            [InlineKeyboardButton(text="⬅️ Назад в меню", callback_data="c:back")],
        ]
    )


def payment_check_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔍 Проверить оплату", callback_data="payment:check")],
            [InlineKeyboardButton(text="⬅️ Назад в меню", callback_data="c:back")],
        ]
    )
