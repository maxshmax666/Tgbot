from __future__ import annotations

import logging
from pathlib import Path

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, FSInputFile, InputMediaPhoto, Message

from .config import Config
from .db import (
    CartItem,
    cart_add,
    cart_clear,
    cart_get,
    cart_snapshot,
    cart_total,
    ensure_user,
    order_create,
    order_get_latest,
    order_set_payment,
    order_set_status,
)
from .keyboards import (
    back_to_menu_keyboard,
    cart_keyboard,
    menu_keyboard,
    payment_check_keyboard,
    payment_keyboard,
)
from .menu import MENU
from .payments import (
    configure_yookassa,
    create_payment_card,
    create_payment_sbp,
    get_payment_status,
)

logger = logging.getLogger(__name__)

router = Router()


def _format_cart(items: list[CartItem]) -> str:
    if not items:
        return "Корзина пуста."
    lines = []
    total = 0
    for item in items:
        line_total = item.price * item.qty
        total += line_total
        lines.append(f"{item.title} x{item.qty} — {line_total} ₽")
    lines.append(f"\nИтого: {total} ₽")
    return "\n".join(lines)


def _format_admin_order(tg_id: int, items: list[CartItem], total: int, method: str) -> str:
    lines = [f"Заказ от пользователя {tg_id}"]
    if not items:
        lines.append("Корзина пуста.")
    else:
        for item in items:
            lines.append(f"{item.title} x{item.qty} — {item.price * item.qty} ₽")
    lines.append(f"Итого: {total} ₽")
    lines.append(f"Оплата: {method}")
    return "\n".join(lines)


@router.message(Command("start"))
async def start(message: Message, config: Config) -> None:
    await ensure_user(config.db_path, message.from_user.id)
    await message.answer(
        "Добро пожаловать! Выберите пиццу из меню ниже.",
        reply_markup=menu_keyboard(),
    )


@router.message(Command("menu"))
async def menu(message: Message) -> None:
    await message.answer("Меню:", reply_markup=menu_keyboard())


@router.callback_query(F.data == "menu")
async def menu_callback(query: CallbackQuery) -> None:
    await query.message.edit_text("Меню:", reply_markup=menu_keyboard())
    await query.answer()


@router.callback_query(F.data.startswith("add:"))
async def add_to_cart_handler(query: CallbackQuery, config: Config) -> None:
    code = query.data.split(":", 1)[1]
    item = MENU.get(code)
    if not item:
        await query.answer("Позиция не найдена.", show_alert=True)
        return
    await cart_add(
        config.db_path,
        query.from_user.id,
        pizza_code=code,
        title=str(item["title"]),
        price=int(item["price"]),
    )
    items = await cart_get(config.db_path, query.from_user.id)
    total = sum(cart_item.price * cart_item.qty for cart_item in items)
    qty = next((cart_item.qty for cart_item in items if cart_item.pizza_code == code), 0)
    await query.answer(
        f"Добавлено: {item['title']}. В корзине: {qty} шт, сумма: {total} ₽"
    )


@router.callback_query(F.data == "cart:view")
@router.message(Command("cart"))
async def view_cart(event: Message | CallbackQuery, config: Config) -> None:
    message = event.message if isinstance(event, CallbackQuery) else event
    items = await cart_get(config.db_path, message.from_user.id)
    await message.answer(_format_cart(items), reply_markup=cart_keyboard())
    if isinstance(event, CallbackQuery):
        await event.answer()


@router.callback_query(F.data == "cart:clear")
async def clear_cart_handler(query: CallbackQuery, config: Config) -> None:
    await cart_clear(config.db_path, query.from_user.id)
    await query.message.edit_text("Корзина очищена.", reply_markup=back_to_menu_keyboard())
    await query.answer()


@router.callback_query(F.data == "cart:checkout")
async def checkout_handler(query: CallbackQuery, config: Config) -> None:
    total = await cart_total(config.db_path, query.from_user.id)
    if total <= 0:
        await query.answer("Корзина пуста.", show_alert=True)
        return
    await query.message.edit_text("Выберите способ оплаты:", reply_markup=payment_keyboard())
    await query.answer()


@router.callback_query(F.data.startswith("pay:"))
async def payment_handler(query: CallbackQuery, config: Config) -> None:
    method = query.data.split(":", 1)[1]
    items, total = await cart_snapshot(config.db_path, query.from_user.id)
    if total <= 0:
        await query.answer("Корзина пуста.", show_alert=True)
        return

    if not (config.yookassa_shop_id and config.yookassa_secret_key):
        await query.answer("Оплата недоступна: настройте YooKassa.", show_alert=True)
        return

    configure_yookassa(config)
    order_id = await order_create(config.db_path, query.from_user.id, total, method)

    description = f"Заказ #{order_id}"
    if method == "card":
        payment = create_payment_card(
            order_id=order_id,
            amount=total,
            description=description,
            return_url=config.yookassa_return_url,
        )
        await order_set_payment(config.db_path, order_id, payment.payment_id)
        await query.message.edit_text(
            f"Оплата картой: {payment.confirmation_url}",
            reply_markup=payment_check_keyboard(),
            disable_web_page_preview=True,
        )
        await query.answer()
        return

    if method == "sbp":
        payment = create_payment_sbp(order_id=order_id, amount=total, description=description)
        await order_set_payment(config.db_path, order_id, payment.payment_id)
        await query.message.edit_text(
            f"СБП QR: {payment.confirmation_url}",
            reply_markup=payment_check_keyboard(),
            disable_web_page_preview=True,
        )
        await query.answer()
        return

    await query.answer("Неизвестный способ оплаты.", show_alert=True)


@router.callback_query(F.data == "payment:check")
async def payment_check_handler(query: CallbackQuery, bot: Bot, config: Config) -> None:
    order = await order_get_latest(config.db_path, query.from_user.id)
    if not order or not order.payment_id:
        await query.answer("Нет активного платежа.", show_alert=True)
        return

    try:
        status = get_payment_status(order.payment_id)
    except Exception:
        logger.exception("Failed to check payment")
        await query.answer("Не удалось проверить оплату. Попробуйте позже.", show_alert=True)
        return

    if status == "succeeded":
        await order_set_status(config.db_path, order.id, "paid")
        items = await cart_get(config.db_path, query.from_user.id)
        total = sum(item.price * item.qty for item in items)
        await cart_clear(config.db_path, query.from_user.id)
        await query.message.edit_text("Оплата успешна! Заказ принят.", reply_markup=back_to_menu_keyboard())
        admin_text = _format_admin_order(query.from_user.id, items, total, order.payment_method or "-")
        await bot.send_message(config.admin_chat_id, admin_text)
        await query.answer()
        return

    if status == "canceled":
        await order_set_status(config.db_path, order.id, "canceled")
        await query.message.edit_text("Платеж отменен.", reply_markup=back_to_menu_keyboard())
        await query.answer()
        return

    await query.answer("Ожидаем оплату.")


@router.callback_query(F.data == "gallery")
async def gallery_handler(query: CallbackQuery, bot: Bot) -> None:
    gallery_dir = Path(__file__).resolve().parent / "assets" / "gallery"
    if not gallery_dir.exists():
        await query.message.answer("Галерея пуста.", reply_markup=back_to_menu_keyboard())
        await query.answer()
        return

    files = sorted(
        [
            path
            for path in gallery_dir.iterdir()
            if path.suffix.lower() in {".jpg", ".jpeg", ".png"}
        ]
    )

    if not files:
        await query.message.answer("Галерея пуста.", reply_markup=back_to_menu_keyboard())
        await query.answer()
        return

    media = [InputMediaPhoto(media=FSInputFile(path)) for path in files]
    await bot.send_media_group(query.message.chat.id, media)
    await query.message.answer("Меню:", reply_markup=menu_keyboard())
    await query.answer()
