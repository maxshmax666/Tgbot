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
    admin_payload_upsert,
    cart_add,
    cart_clear,
    cart_decrement,
    cart_get_items,
    cart_snapshot,
    cart_total_price,
    get_product_by_code,
    get_product_by_id,
    order_create,
    order_create_webapp,
    order_exists_by_order_id,
    order_get_latest,
    order_set_payment,
    order_set_status,
    order_set_status_by_order_id,
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


def _coerce_optional_amount(value: Any, field_name: str) -> int | None:
    if value is None:
        return None
    return _coerce_amount(value, field_name)


def _parse_webapp_order(payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get("type") != "pizza_order_v1":
        raise ValueError("unsupported order type")
    order_id = str(payload.get("order_id", "")).strip()
    if not order_id:
        raise ValueError("order_id is required")

    items_raw = payload.get("items")
    if not isinstance(items_raw, list) or not items_raw:
        raise ValueError("items must be a non-empty list")

    total = _coerce_optional_amount(payload.get("total"), "total")
    items: list[dict[str, Any]] = []
    for item in items_raw:
        if not isinstance(item, dict):
            continue
        qty = _coerce_amount(item.get("qty"), "qty")
        item_id = str(item.get("id") or item.get("code") or "").strip() or None
        price = _coerce_optional_amount(item.get("price"), "price")
        items.append({"item_id": item_id, "qty": qty, "client_price": price})

    if not items:
        raise ValueError("no valid items")

    customer = payload.get("customer") or {}
    delivery = payload.get("delivery") or {}
    payment = payload.get("payment") or {}
    user = payload.get("user") or {}

    phone = str(customer.get("phone", "")).strip()
    if not phone:
        raise ValueError("phone is required")
    name = str(customer.get("name", "")).strip()
    address = str(delivery.get("address", "")).strip()
    delivery_type = str(delivery.get("type", "delivery")).strip()
    payment_method = str(payment.get("method", "")).strip()
    comment = str(payload.get("comment", "")).strip()

    return {
        "order_id": order_id,
        "items": items,
        "total": total,
        "name": name,
        "phone": phone,
        "address": address,
        "delivery_type": delivery_type,
        "payment_method": payment_method,
        "comment": comment,
        "username": str(user.get("username", "")).strip() or None,
    }


async def _recalculate_webapp_items(
    db_path: str,
    order_id: str,
    items: list[dict[str, Any]],
    client_total: int | None,
) -> tuple[list[OrderItemInput], int]:
    recalculated: list[OrderItemInput] = []
    for item in items:
        item_id = item.get("item_id")
        qty = item.get("qty")
        client_price = item.get("client_price")
        if not item_id:
            raise ValueError("Отсутствует идентификатор товара.")
        if qty is None or qty <= 0:
            raise ValueError(f"Некорректное количество для товара {item_id}.")

        product = None
        if str(item_id).isdigit():
            product = await get_product_by_id(db_path, int(item_id))
        if product is None:
            product = await get_product_by_code(db_path, str(item_id))
        if product is None:
            raise ValueError(f"Товар {item_id} не найден.")

        if client_price is not None and client_price != product.price:
            logger.warning(
                "Webapp price mismatch: order=%s item=%s client=%s db=%s",
                order_id,
                item_id,
                client_price,
                product.price,
            )

        subtotal = qty * product.price
        recalculated.append(
            OrderItemInput(
                item_id=str(product.id),
                title=product.title,
                qty=qty,
                price=product.price,
                subtotal=subtotal,
            )
        )

    total = sum(item.subtotal for item in recalculated)
    if client_total is not None and client_total != total:
        logger.warning(
            "Webapp total mismatch: order=%s client=%s db=%s", order_id, client_total, total
        )
    return recalculated, total


def _format_webapp_order(parsed: dict[str, Any]) -> str:
    lines = ["✅ Заказ из Mini App получен.", f"Заказ: {escape(parsed['order_id'])}", "", "Состав заказа:"]
    for item in parsed["items"]:
        title = escape(item.title)
        lines.append(f"• {title} — {item.qty} × {item.price} ₽ = {item.subtotal} ₽")
    lines.append("")
    lines.append(f"Итого: {parsed['total']} ₽")
    lines.append(f"Оплата: {escape(parsed['payment_method'] or '-')}")
    lines.append(f"Доставка: {escape(parsed['delivery_type'])}")

    lines.append("")
    lines.append("Контакты:")
    if parsed.get("name"):
        lines.append(f"Имя: {escape(parsed['name'])}")
    lines.append(f"Телефон: {escape(parsed['phone'])}")
    if parsed.get("address"):
        lines.append(f"Адрес: {escape(parsed['address'])}")
    if parsed.get("comment"):
        lines.append("")
        lines.append("Комментарий:")
        lines.append(escape(parsed["comment"]))

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

    if query.message:
        try:
            await query.message.edit_caption(
                "Платеж в обработке. Попробуйте позже.",
                reply_markup=payment_check_keyboard(),
            )
        except (TelegramBadRequest, TelegramNotFound):
            logger.debug("Failed to update payment check message", exc_info=True)
    await query.answer("Платеж еще не завершен. Попробуйте позже.")


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
        if str(payload.get("type", "")).startswith("admin_"):
            if payload.get("type") == "admin_order_status_v1":
                order_id = str(payload.get("order_id", "")).strip()
                status = str(payload.get("status", "")).strip()
                if order_id and status:
                    await order_set_status_by_order_id(str(config.db_path), order_id, status)
            await admin_payload_upsert(str(config.db_path), payload["type"], json.dumps(payload))
            await message.answer("Админ-данные сохранены ✅")
            return
        parsed = _parse_webapp_order(payload)
        recalculated_items, recalculated_total = await _recalculate_webapp_items(
            str(config.db_path),
            parsed["order_id"],
            parsed["items"],
            parsed["total"],
        )
        parsed["items"] = recalculated_items
        parsed["total"] = recalculated_total
        confirmation = _format_webapp_order(parsed)
    except json.JSONDecodeError as error:
        logger.warning("Invalid web app payload: %s", error)
        await message.answer("Некорректные данные заказа. Проверьте корзину и повторите.")
        return
    except (ValueError, TypeError) as error:
        logger.warning("Invalid web app payload: %s", error)
        await message.answer(f"Заказ отклонен: {error}")
        return

    try:
        if await order_exists_by_order_id(str(config.db_path), parsed["order_id"]):
            await message.answer("Этот заказ уже принят ✅")
            return
        await order_create_webapp(
            db_path=str(config.db_path),
            tg_id=message.from_user.id,
            username=parsed.get("username"),
            order_id=parsed["order_id"],
            phone=parsed["phone"],
            name=parsed.get("name"),
            delivery_type=parsed["delivery_type"],
            address=parsed.get("address"),
            payment_method=parsed.get("payment_method") or "cash",
            total=parsed["total"],
            status="new",
            items=parsed["items"],
        )
    except Exception:
        logger.exception("Failed to persist webapp order")
        await message.answer("Не удалось сохранить заказ. Попробуйте снова позже.")
        return

    await message.answer(confirmation)
    try:
        await message.bot.send_message(config.admin_chat_id, confirmation)
    except Exception:
        logger.exception("Failed to notify admin about webapp order")
