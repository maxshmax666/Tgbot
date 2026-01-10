from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

def menu_actions_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Корзина", callback_data="cart:view"),
                InlineKeyboardButton(text="Галерея", callback_data="gallery"),
            ]
        ]
    )


def cart_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Оформить заказ", callback_data="cart:checkout")],
            [InlineKeyboardButton(text="Очистить корзину", callback_data="cart:clear")],
            [InlineKeyboardButton(text="Назад в меню", callback_data="menu")],
        ]
    )


def payment_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Карта", callback_data="pay:card")],
            [InlineKeyboardButton(text="СБП QR", callback_data="pay:sbp")],
            [InlineKeyboardButton(text="Назад в меню", callback_data="menu")],
        ]
    )


def payment_check_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Проверить оплату", callback_data="payment:check")],
            [InlineKeyboardButton(text="Назад в меню", callback_data="menu")],
        ]
    )


def back_to_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="Назад в меню", callback_data="menu")]]
    )


def menu_item_keyboard(code: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Подробнее", callback_data=f"pizza:{code}"),
                InlineKeyboardButton(text="В корзину", callback_data=f"add:{code}"),
            ]
        ]
    )


def pizza_keyboard(code: str, show_gallery: bool = True) -> InlineKeyboardMarkup:
    buttons = [
        [
            InlineKeyboardButton(text="Добавить в корзину", callback_data=f"add:{code}"),
            InlineKeyboardButton(text="В меню", callback_data="menu"),
        ]
    ]
    if show_gallery:
        buttons.append([InlineKeyboardButton(text="Галерея", callback_data=f"gallery:{code}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
