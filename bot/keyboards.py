from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from .menu import MENU_ITEMS


def menu_keyboard() -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=f"{item.name} — {item.price}₽", callback_data=f"add:{item.code}")]
        for item in MENU_ITEMS
    ]
    buttons.append([InlineKeyboardButton(text="Корзина", callback_data="cart:view")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def cart_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Оформить заказ", callback_data="cart:checkout")],
            [InlineKeyboardButton(text="Очистить корзину", callback_data="cart:clear")],
            [InlineKeyboardButton(text="Назад в меню", callback_data="menu")],
        ]
    )


def delivery_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Доставка", callback_data="delivery:delivery")],
            [InlineKeyboardButton(text="Самовывоз", callback_data="delivery:pickup")],
        ]
    )


def payment_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Оплата в чате (ЮKassa)", callback_data="pay:chat")],
            [InlineKeyboardButton(text="Перевод по QR", callback_data="pay:qr")],
            [InlineKeyboardButton(text="Наличные", callback_data="pay:cash")],
        ]
    )


def back_to_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="Назад в меню", callback_data="menu")]]
    )
