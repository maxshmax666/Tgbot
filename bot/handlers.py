from __future__ import annotations

import asyncio
import io
import logging
from typing import Callable

import qrcode
from aiogram import Bot, F, Router
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandObject
from aiogram.types import CallbackQuery, LabeledPrice, Message, PreCheckoutQuery, SuccessfulPayment

from .config import Config
from .db import CartItem, Database, Order
from .emailer import send_admin_email
from .keyboards import (
    back_to_menu_keyboard,
    cart_keyboard,
    delivery_keyboard,
    menu_keyboard,
    payment_keyboard,
)
from .menu import MENU_BY_CODE
from .payments import configure_yookassa, create_payment, get_payment_status

logger = logging.getLogger(__name__)

router = Router()


def _format_cart(items: list[CartItem]) -> str:
    if not items:
        return "Корзина пуста."
    lines = ["Ваш заказ:"]
    total = 0
    for item in items:
        line_total = item.price * item.qty
        total += line_total
        lines.append(f"• {item.name} × {item.qty} = {line_total}₽")
    lines.append(f"\nИтого: {total}₽")
    return "\n".join(lines)


def _format_order_summary(order: Order, items: list[CartItem]) -> str:
    summary = _format_cart(items)
    details = [
        f"Доставка: {order.delivery_type or '-'}",
        f"Адрес: {order.address or '-'}",
        f"Время: {order.desired_time or '-'}",
        f"Телефон: {order.phone or '-'}",
        f"Оплата: {order.payment_method or '-'} ({order.payment_status or '-'})",
    ]
    return f"{summary}\n\n" + "\n".join(details)


async def _notify_admin(
    bot: Bot, config: Config, order: Order, items: list[CartItem]
) -> None:
    text = f"Новый заказ #{order.id}\n\n{_format_order_summary(order, items)}"
    await bot.send_message(config.admin_chat_id, text)
    await send_admin_email(config, f"Новый заказ #{order.id}", text)


async def _ensure_order(
    db: Database, user_id: int, items: list[CartItem]
) -> Order | None:
    if not items:
        return None
    order_id = await db.create_order_from_cart(user_id, items)
    await db.clear_cart(user_id)
    order = await db.get_current_order(user_id)
    if not order:
        raise RuntimeError("Order not found after creation")
    return order


@router.message(Command("start"))
async def start(message: Message, db: Database) -> None:
    await db.ensure_user(message.from_user.id)
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
async def add_to_cart(query: CallbackQuery, db: Database) -> None:
    await db.ensure_user(query.from_user.id)
    code = query.data.split(":", 1)[1]
    item = MENU_BY_CODE.get(code)
    if not item:
        await query.answer("Позиция не найдена.", show_alert=True)
        return
    user_id = await db.ensure_user(query.from_user.id)
    await db.add_to_cart(user_id, item.code, item.name, item.price)
    await query.answer(f"Добавлено: {item.name}")


@router.callback_query(F.data == "cart:view")
@router.message(Command("cart"))
async def view_cart(event: Message | CallbackQuery, db: Database) -> None:
    message = event.message if isinstance(event, CallbackQuery) else event
    user_id = await db.ensure_user(message.from_user.id)
    items = await db.get_cart(user_id)
    await message.answer(_format_cart(items), reply_markup=cart_keyboard())
    if isinstance(event, CallbackQuery):
        await event.answer()


@router.callback_query(F.data == "cart:clear")
async def clear_cart(query: CallbackQuery, db: Database) -> None:
    user_id = await db.ensure_user(query.from_user.id)
    await db.clear_cart(user_id)
    await query.message.edit_text("Корзина очищена.", reply_markup=back_to_menu_keyboard())
    await query.answer()


@router.callback_query(F.data == "cart:checkout")
async def checkout(query: CallbackQuery, db: Database) -> None:
    user_id = await db.ensure_user(query.from_user.id)
    items = await db.get_cart(user_id)
    if not items:
        await query.answer("Корзина пуста.", show_alert=True)
        return
    order = await _ensure_order(db, user_id, items)
    if not order:
        await query.answer("Корзина пуста.", show_alert=True)
        return
    await db.update_order_fields(
        order.id,
        status="draft",
        payment_status="waiting_details",
    )
    await query.message.edit_text("Выберите способ получения:", reply_markup=delivery_keyboard())
    await query.answer()


@router.callback_query(F.data.startswith("delivery:"))
async def delivery_choice(query: CallbackQuery, db: Database) -> None:
    user_id = await db.ensure_user(query.from_user.id)
    order = await db.get_current_order(user_id)
    if not order:
        await query.answer("Сначала добавьте позиции в корзину.", show_alert=True)
        return
    delivery_type = query.data.split(":", 1)[1]
    await db.update_order_fields(order.id, delivery_type=delivery_type)
    if delivery_type == "delivery":
        await query.message.edit_text("Введите адрес доставки:")
    else:
        await query.message.edit_text("Введите время самовывоза (например 18:30):")
    await query.answer()


@router.message(F.text & ~F.text.startswith("/"))
async def collect_details(message: Message, db: Database) -> None:
    user_id = await db.ensure_user(message.from_user.id)
    order = await db.get_current_order(user_id)
    if not order or order.status != "draft":
        return

    if not order.delivery_type:
        await message.answer("Сначала выберите способ получения.", reply_markup=delivery_keyboard())
        return

    if order.delivery_type == "delivery" and not order.address:
        await db.update_order_fields(order.id, address=message.text)
        await message.answer("Введите удобное время доставки (например 19:00):")
        return

    if not order.desired_time:
        await db.update_order_fields(order.id, desired_time=message.text)
        await message.answer("Введите номер телефона для связи:")
        return

    if not order.phone:
        await db.update_order_fields(order.id, phone=message.text)
        await message.answer("Выберите способ оплаты:", reply_markup=payment_keyboard())
        return


@router.callback_query(F.data.startswith("pay:"))
async def payment_choice(query: CallbackQuery, bot: Bot, db: Database, config: Config) -> None:
    user_id = await db.ensure_user(query.from_user.id)
    order = await db.get_current_order(user_id)
    if not order:
        await query.answer("Заказ не найден.", show_alert=True)
        return

    method = query.data.split(":", 1)[1]
    items = await db.get_order_items(order.id)

    if method == "cash":
        await db.update_order_fields(
            order.id,
            payment_method="cash",
            payment_status="cash_on_delivery",
            status="accepted",
        )
        refreshed = await db.get_order(order.id)
        await _notify_admin(bot, config, refreshed or order, items)
        await db.set_current_order(user_id, None)
        await query.message.edit_text("Заказ оформлен! Оплата наличными при получении.")
        await query.answer()
        return

    if method == "qr":
        await db.update_order_fields(
            order.id,
            payment_method="qr",
            payment_status="pending_qr",
            status="awaiting_payment",
        )
        payload = config.qr_payload or f"ORDER:{order.id};AMOUNT:{order.total_amount}"
        qr = qrcode.make(payload)
        buf = io.BytesIO()
        qr.save(buf, format="PNG")
        buf.seek(0)
        await bot.send_photo(
            query.message.chat.id,
            buf,
            caption=(
                f"Сканируйте QR для оплаты {order.total_amount}₽.\n"
                "После оплаты напишите 'Оплатил(а)'."
            ),
        )
        await query.answer()
        return

    if method == "chat":
        await db.update_order_fields(
            order.id,
            payment_method="chat",
            payment_status="pending",
            status="awaiting_payment",
        )
        if config.telegram_provider_token:
            prices = [
                LabeledPrice(label=item.name, amount=item.price * item.qty * 100)
                for item in items
            ]
            await bot.send_invoice(
                chat_id=query.message.chat.id,
                title=f"Заказ #{order.id}",
                description="Оплата заказа пиццы",
                payload=f"order:{order.id}",
                provider_token=config.telegram_provider_token,
                currency=config.currency,
                prices=prices,
            )
            await query.answer()
            return

        if config.yookassa_shop_id and config.yookassa_secret_key:
            configure_yookassa(config)
            payment = create_payment(
                config,
                order_id=order.id,
                amount=order.total_amount,
                description=f"Заказ #{order.id}",
            )
            await db.update_order_fields(
                order.id,
                payment_method="yookassa",
                payment_status=payment.status,
                yookassa_payment_id=payment.payment_id,
            )
            await query.message.edit_text(
                f"Оплатите по ссылке: {payment.confirmation_url}",
                disable_web_page_preview=True,
            )
            await query.answer()
            return

        await query.answer("Оплата недоступна: настройте TELEGRAM_PROVIDER_TOKEN или YooKassa.", show_alert=True)


@router.message(F.text.lower().contains("оплатил"))
async def confirm_qr_payment(message: Message, bot: Bot, db: Database, config: Config) -> None:
    user_id = await db.ensure_user(message.from_user.id)
    order = await db.get_current_order(user_id)
    if not order or order.payment_method != "qr":
        return
    await db.update_order_fields(order.id, payment_status="manual_check", status="pending_confirmation")
    items = await db.get_order_items(order.id)
    await _notify_admin(bot, config, order, items)
    await db.set_current_order(user_id, None)
    await message.answer("Спасибо! Ожидаем подтверждение оплаты.")


@router.pre_checkout_query()
async def pre_checkout(pre_checkout_query: PreCheckoutQuery) -> None:
    await pre_checkout_query.answer(ok=True)


@router.message(F.successful_payment)
async def successful_payment(
    message: Message, bot: Bot, db: Database, config: Config
) -> None:
    payload = message.successful_payment.invoice_payload
    if not payload.startswith("order:"):
        return
    order_id = int(payload.split(":", 1)[1])
    await db.update_order_fields(
        order_id,
        payment_status="paid",
        status="accepted",
    )
    items = await db.get_order_items(order_id)
    order = await db.get_order(order_id)
    if order:
        await db.set_current_order(order.user_id, None)
        await _notify_admin(bot, config, order, items)
    await message.answer("Оплата прошла успешно! Заказ принят.")


@router.message(Command("orders"))
async def list_orders(message: Message, db: Database, config: Config) -> None:
    if message.from_user.id != config.admin_chat_id:
        return
    orders = await db.list_recent_orders()
    if not orders:
        await message.answer("Заказов нет.")
        return
    lines = ["Последние заказы:"]
    for order in orders:
        lines.append(
            f"#{order.id} • {order.status} • {order.total_amount}₽ • {order.payment_status}"
        )
    await message.answer("\n".join(lines))


@router.message(Command("mark_paid"))
async def mark_paid(message: Message, db: Database, config: Config, command: CommandObject) -> None:
    if message.from_user.id != config.admin_chat_id:
        return
    if not command.args:
        await message.answer("Использование: /mark_paid <order_id>")
        return
    order_id = int(command.args.strip())
    await db.update_order_fields(order_id, payment_status="paid", status="accepted")
    await message.answer(f"Заказ #{order_id} отмечен как оплаченный.")


async def yookassa_poller(
    bot: Bot, db: Database, config: Config, interval: int = 30
) -> None:
    if not (config.yookassa_shop_id and config.yookassa_secret_key):
        return
    configure_yookassa(config)
    while True:
        try:
            pending = await db.get_pending_yookassa_orders()
            for order in pending:
                status = get_payment_status(order.yookassa_payment_id)
                if status == "succeeded":
                    await db.update_order_fields(
                        order.id,
                        payment_status="paid",
                        status="accepted",
                    )
                    items = await db.get_order_items(order.id)
                    await _notify_admin(bot, config, order, items)
        except Exception:
            logger.exception("Failed to poll YooKassa")
        await asyncio.sleep(interval)
