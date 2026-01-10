from __future__ import annotations

import logging

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramBadRequest, TelegramNotFound
from aiogram.types import CallbackQuery

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
    order_create,
    order_get_latest,
    order_set_payment,
    order_set_status,
)
from bot.utils.formatting import format_admin_order, format_cart
from bot.utils.media import build_media, get_placeholder_photo

logger = logging.getLogger(__name__)

router = Router()


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

    await query.answer("Ожидаем оплату.")
