from __future__ import annotations

import json
import logging
from html import escape
from typing import Any

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramBadRequest, TelegramNotFound
from aiogram.types import CallbackQuery, Message

from bot.config import Config
from bot.features.cart.keyboards import cart_keyboard, payment_check_keyboard, payment_keyboard
from bot.features.menu.handlers import render_menu
from bot.features.menu.state import MenuStateStore
from bot.payments import configure_yookassa, create_payment_card, create_payment_sbp, get_payment_status
from bot.storage.repos import (
    cart_add,
    cart_clear,
    cart_decrement,
    cart_get_items,
    cart_snapshot,
    cart_total_price,
    order_create_with_items,
    order_create,
    order_get_latest,
    order_set_payment,
    order_set_status,
    OrderItemInput,
)
from bot.utils.formatting import format_admin_order, format_cart
from bot.utils.media import build_media, get_placeholder_photo

logger = logging.getLogger(__name__)

router = Router()


def _coerce_amount(value: Any, field_name: str) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{field_name} must be a number")
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned.isdigit():
            return int(cleaned)
    raise ValueError(f"{field_name} must be a number")


def _parse_webapp_order(
    payload: dict[str, Any],
) -> tuple[list[OrderItemInput], int, str, str, str, str]:
    items_raw = payload.get("items")
    if not isinstance(items_raw, list) or not items_raw:
        raise ValueError("items must be a non-empty list")

    total = _coerce_amount(payload.get("total"), "total")
    items: list[OrderItemInput] = []
    for item in items_raw:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        if not title:
            continue
        qty = _coerce_amount(item.get("qty"), "qty")
        price = _coerce_amount(item.get("price"), "price")
        subtotal = item.get("subtotal")
        if subtotal is None:
            subtotal_value = qty * price
        else:
            subtotal_value = _coerce_amount(subtotal, "subtotal")
        items.append(
            OrderItemInput(title=title, qty=qty, price=price, subtotal=subtotal_value)
        )

    if not items:
        raise ValueError("no valid items")

    name = str(payload.get("name", "")).strip()
    phone = str(payload.get("phone", "")).strip()
    address = str(payload.get("address", "")).strip()
    comment = str(payload.get("comment", "")).strip()
    return items, total, name, phone, address, comment


def _format_webapp_order(
    items: list[OrderItemInput],
    total: int,
    name: str,
    phone: str,
    address: str,
    comment: str,
) -> str:
    lines = ["✅ Заказ из Mini App получен.", "", "Состав заказа:"]
    for item in items:
        title = escape(item.title)
        lines.append(
            f"• {title} — {item.qty} × {item.price} ₽ = {item.subtotal} ₽"
        )
    lines.append("")
    lines.append(f"Итого: {total} ₽")

    if name or phone or address:
        lines.append("")
        lines.append("Контакты:")
        if name:
            lines.append(f"Имя: {escape(name)}")
        if phone:
            lines.append(f"Телефон: {escape(phone)}")
        if address:
            lines.append(f"Адрес: {escape(address)}")
    if comment:
        lines.append("")
        lines.append("Комментарий:")
        lines.append(escape(comment))

    return "\n".join(lines)


async def _edit_or_send_cart(
    bot: Bot,
    chat_id: int,
    user_id: int,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    items = await cart_get_items(config.db_path, user_id)
    total = await cart_total_price(config.db_path, user_id)
    caption = format_cart(items, total)
    media = build_media(get_placeholder_photo(), caption)
    keyboard = cart_keyboard(items)

    state = menu_state.get(user_id)
    state.in_cart = True
    if state.message_id and state.chat_id == chat_id:
        try:
            await bot.edit_message_media(
                chat_id=chat_id,
                message_id=state.message_id,
                media=media,
                reply_markup=keyboard,
            )
            return
        except (TelegramBadRequest, TelegramNotFound):
            logger.warning("Cart message missing for user %s, sending new one", user_id)
    sent = await bot.send_photo(
        chat_id=chat_id,
        photo=media.media,
        caption=media.caption,
        parse_mode="HTML",
        reply_markup=keyboard,
    )
    state.message_id = sent.message_id
    state.chat_id = chat_id


@router.callback_query(F.data == "c:open")
async def open_cart_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    logger.info("Cart opened by user %s", query.from_user.id)
    async with menu_state.get_lock(query.from_user.id):
        await _edit_or_send_cart(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer()


@router.callback_query(F.data.startswith("c:inc:"))
async def cart_increment_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    product_id = int(query.data.split(":", 2)[2])
    async with menu_state.get_lock(query.from_user.id):
        await cart_add(config.db_path, query.from_user.id, product_id, qty=1)
        state = menu_state.get(query.from_user.id)
        if state.in_cart:
            await _edit_or_send_cart(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
        else:
            await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer("Добавлено")


@router.callback_query(F.data.startswith("c:dec:"))
async def cart_decrement_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    product_id = int(query.data.split(":", 2)[2])
    async with menu_state.get_lock(query.from_user.id):
        await cart_decrement(config.db_path, query.from_user.id, product_id)
        state = menu_state.get(query.from_user.id)
        if state.in_cart:
            await _edit_or_send_cart(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
        else:
            await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer("Обновлено")


@router.callback_query(F.data == "c:clear")
async def clear_cart_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    async with menu_state.get_lock(query.from_user.id):
        await cart_clear(config.db_path, query.from_user.id)
        await _edit_or_send_cart(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer("Корзина очищена")


@router.callback_query(F.data == "c:back")
async def back_to_menu_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    async with menu_state.get_lock(query.from_user.id):
        await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer()


@router.callback_query(F.data == "c:checkout")
async def checkout_handler(query: CallbackQuery, config: Config) -> None:
    total = await cart_total_price(config.db_path, query.from_user.id)
    if total <= 0:
        await query.answer("Корзина пуста.", show_alert=True)
        return
    await query.message.edit_caption("Выберите способ оплаты:", reply_markup=payment_keyboard())
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
        await query.message.edit_caption(
            f"Оплата картой: {payment.confirmation_url}",
            reply_markup=payment_check_keyboard(),
        )
        await query.answer()
        return

    if method == "sbp":
        payment = create_payment_sbp(order_id=order_id, amount=total, description=description)
        await order_set_payment(config.db_path, order_id, payment.payment_id)
        await query.message.edit_caption(
            f"СБП QR: {payment.confirmation_url}",
            reply_markup=payment_check_keyboard(),
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
        items = await cart_get_items(config.db_path, query.from_user.id)
        total = sum(item.price * item.qty for item in items)
        await cart_clear(config.db_path, query.from_user.id)
        await query.message.edit_caption("Оплата успешна! Заказ принят.", reply_markup=None)
        admin_text = format_admin_order(query.from_user.id, items, total, order.payment_method or "-")
        await bot.send_message(config.admin_chat_id, admin_text)
        await query.answer()
        return

    if status == "canceled":
        await order_set_status(config.db_path, order.id, "canceled")
        await query.message.edit_caption("Платеж отменен.", reply_markup=None)
        await query.answer()
        return


@router.message(F.web_app_data)
async def webapp_order_handler(message: Message, config: Config) -> None:
    raw = message.web_app_data.data if message.web_app_data else ""
    if not raw:
        await message.answer("Пустые данные заказа. Попробуйте снова.")
        return
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("payload is not a dict")
        items, total, name, phone, address, comment = _parse_webapp_order(payload)
        confirmation = _format_webapp_order(items, total, name, phone, address, comment)
    except (json.JSONDecodeError, ValueError, TypeError) as error:
        logger.warning("Invalid web app payload: %s", error)
        await message.answer("Некорректные данные заказа. Проверьте корзину и повторите.")
        return

    try:
        await order_create_with_items(
            db_path=str(config.db_path),
            tg_id=message.from_user.id,
            total=total,
            status="received",
            payment_method="webapp",
            items=items,
        )
    except Exception:
        logger.exception("Failed to persist webapp order")
        await message.answer("Не удалось сохранить заказ. Попробуйте снова позже.")
        return

    await message.answer(confirmation)
