from __future__ import annotations

import html

from bot.storage.repos import CartItem, Product


def format_menu_caption(
    product: Product,
    item_index: int,
    total_items: int,
    photo_index: int,
    total_photos: int,
    show_details: bool,
    category_label: str | None = None,
    search_query: str | None = None,
) -> str:
    title = product.title
    price = product.price
    description = product.details if show_details else product.description
    parts = [f"<b>{title}</b>", f"Цена: {price} ₽"]
    if description:
        parts.insert(1, description)
    if product.is_popular:
        parts.append("🔥 Хит")
    if product.is_new:
        parts.append("🆕 Новинка")

    indicator = f"Позиция {item_index + 1}/{max(total_items, 1)}"
    photo_indicator = f"Фото {photo_index + 1}/{max(total_photos, 1)}"
    meta = " • ".join([indicator, photo_indicator])
    parts.append(meta)

    if category_label:
        parts.append(f"Категория: {category_label}")
    if search_query:
        parts.append(f"Поиск: «{html.escape(search_query)}»")

    return "\n".join(parts)


def format_empty_menu(category_label: str | None = None, search_query: str | None = None) -> str:
    lines = ["Ничего не найдено по текущим фильтрам."]
    if category_label:
        lines.append(f"Категория: {category_label}")
    if search_query:
        lines.append(f"Поиск: «{html.escape(search_query)}»")
    return "\n".join(lines)


def format_cart(items: list[CartItem], total: int) -> str:
    if not items:
        return "Корзина пуста."
    lines = []
    for item in items:
        line_total = item.price * item.qty
        lines.append(f"{item.title} x{item.qty} — {line_total} ₽")
    lines.append("")
    lines.append(f"Итого: {total} ₽")
    return "\n".join(lines)


def format_admin_order(tg_id: int, items: list[CartItem], total: int, method: str) -> str:
    lines = [f"Заказ от пользователя {tg_id}"]
    if not items:
        lines.append("Корзина пуста.")
    else:
        for item in items:
            lines.append(f"{item.title} x{item.qty} — {item.price * item.qty} ₽")
    lines.append(f"Итого: {total} ₽")
    lines.append(f"Оплата: {method}")
    return "\n".join(lines)
