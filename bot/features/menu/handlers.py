from __future__ import annotations

import logging

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramBadRequest, TelegramNotFound
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from bot.config import Config
from bot.features.menu.keyboards import categories_keyboard, menu_keyboard
from bot.features.menu.state import MenuStateStore
from bot.storage.repos import (
    cart_add,
    cart_item_qty,
    cart_total_qty,
    get_categories,
    get_products,
)
from bot.utils.formatting import format_empty_menu, format_menu_caption
from bot.utils.media import build_media, get_placeholder_photo, get_product_photos
from bot.utils.throttle import Throttle

logger = logging.getLogger(__name__)

router = Router()


def _clamp_index(index: int, total: int) -> int:
    if total <= 0:
        return 0
    return index % total


async def _category_label(db_path: str, code: str | None) -> str | None:
    if not code:
        return None
    categories = await get_categories(db_path)
    for category in categories:
        if category.code == code:
            return category.title
    return code


async def render_menu(
    bot: Bot,
    chat_id: int,
    user_id: int,
    config: Config,
    state_store: MenuStateStore,
) -> None:
    state = state_store.get(user_id)
    state.in_cart = False
    products = await get_products(
        config.db_path,
        category=state.category,
        search=state.search_query,
    )
    cart_qty = await cart_total_qty(config.db_path, user_id)
    category_label = await _category_label(config.db_path, state.category)

    if not products:
        caption = format_empty_menu(category_label, state.search_query)
        placeholder = get_placeholder_photo()
        keyboard = menu_keyboard(
            cart_qty=cart_qty,
            show_photo_nav=False,
            show_reset=bool(state.category or state.search_query),
            can_decrement=False,
            product_id=0,
        )
        await _edit_or_send_media(
            bot,
            chat_id,
            state_store,
            user_id,
            build_media(placeholder, caption),
            keyboard,
        )
        return

    state.item_index = _clamp_index(state.item_index, len(products))
    product = products[state.item_index]
    photos = get_product_photos(product) or [get_placeholder_photo()]
    state.photo_index = _clamp_index(state.photo_index, len(photos))

    caption = format_menu_caption(
        product=product,
        item_index=state.item_index,
        total_items=len(products),
        photo_index=state.photo_index,
        total_photos=len(photos),
        show_details=state.show_details,
        category_label=category_label,
        search_query=state.search_query,
    )
    qty = await cart_item_qty(config.db_path, user_id, product.id)
    keyboard = menu_keyboard(
        cart_qty=cart_qty,
        show_photo_nav=len(photos) > 1,
        show_reset=bool(state.category or state.search_query),
        can_decrement=qty > 0,
        product_id=product.id,
    )

    media = build_media(photos[state.photo_index], caption)
    await _edit_or_send_media(bot, chat_id, state_store, user_id, media, keyboard)


async def _edit_or_send_media(
    bot: Bot,
    chat_id: int,
    state_store: MenuStateStore,
    user_id: int,
    media: object,
    keyboard: object,
) -> None:
    state = state_store.get(user_id)
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
            logger.warning("Menu message missing for user %s, sending new one", user_id)
    sent = await bot.send_photo(
        chat_id=chat_id,
        photo=media.media,
        caption=media.caption,
        parse_mode="HTML",
        reply_markup=keyboard,
    )
    state.message_id = sent.message_id
    state.chat_id = chat_id


@router.message(Command("start"))
async def start_handler(message: Message, config: Config, menu_state: MenuStateStore) -> None:
    await render_menu(message.bot, message.chat.id, message.from_user.id, config, menu_state)


@router.message(Command("menu"))
async def menu_command_handler(message: Message, config: Config, menu_state: MenuStateStore) -> None:
    logger.info("Menu opened by user %s", message.from_user.id)
    state = menu_state.get(message.from_user.id)
    state.categories_mode = False
    await render_menu(message.bot, message.chat.id, message.from_user.id, config, menu_state)


@router.message(F.text == "🍕 Меню")
async def menu_text_handler(message: Message, config: Config, menu_state: MenuStateStore) -> None:
    await menu_command_handler(message, config, menu_state)


@router.callback_query(F.data == "m:i:prev")
async def item_prev_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
    throttle: Throttle,
) -> None:
    if not throttle.allow(query.from_user.id):
        await query.answer("Слишком быстро.")
        return
    async with menu_state.get_lock(query.from_user.id):
        state = menu_state.get(query.from_user.id)
        state.item_index -= 1
        state.photo_index = 0
        state.show_details = False
        state.categories_mode = False
        await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer()


@router.callback_query(F.data == "m:i:next")
async def item_next_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
    throttle: Throttle,
) -> None:
    if not throttle.allow(query.from_user.id):
        await query.answer("Слишком быстро.")
        return
    async with menu_state.get_lock(query.from_user.id):
        state = menu_state.get(query.from_user.id)
        state.item_index += 1
        state.photo_index = 0
        state.show_details = False
        state.categories_mode = False
        await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer()


@router.callback_query(F.data == "m:p:prev")
async def photo_prev_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
    throttle: Throttle,
) -> None:
    if not throttle.allow(query.from_user.id):
        await query.answer("Слишком быстро.")
        return
    async with menu_state.get_lock(query.from_user.id):
        state = menu_state.get(query.from_user.id)
        state.photo_index -= 1
        await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer()


@router.callback_query(F.data == "m:p:next")
async def photo_next_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
    throttle: Throttle,
) -> None:
    if not throttle.allow(query.from_user.id):
        await query.answer("Слишком быстро.")
        return
    async with menu_state.get_lock(query.from_user.id):
        state = menu_state.get(query.from_user.id)
        state.photo_index += 1
        await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer()


@router.callback_query(F.data == "m:add")
async def add_to_cart_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    async with menu_state.get_lock(query.from_user.id):
        state = menu_state.get(query.from_user.id)
        products = await get_products(
            config.db_path,
            category=state.category,
            search=state.search_query,
        )
        if not products:
            await query.answer("Меню пусто.", show_alert=True)
            return
        product = products[_clamp_index(state.item_index, len(products))]
        await cart_add(config.db_path, query.from_user.id, product.id, qty=1)
        logger.info("Added to cart user=%s product=%s", query.from_user.id, product.code)
        await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer("Добавлено в корзину")


@router.callback_query(F.data == "m:info")
async def info_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    async with menu_state.get_lock(query.from_user.id):
        state = menu_state.get(query.from_user.id)
        state.show_details = not state.show_details
        await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer()


@router.callback_query(F.data == "m:cat")
async def categories_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    async with menu_state.get_lock(query.from_user.id):
        state = menu_state.get(query.from_user.id)
        if state.categories_mode:
            state.categories_mode = False
            await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
            await query.answer()
            return
        categories = await get_categories(config.db_path)
        state.categories_mode = True
        try:
            await query.bot.edit_message_reply_markup(
                chat_id=query.message.chat.id,
                message_id=query.message.message_id,
                reply_markup=categories_keyboard(categories, state.category),
            )
        except (TelegramBadRequest, TelegramNotFound):
            state.categories_mode = False
            await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer()


@router.callback_query(F.data.startswith("m:cat:"))
async def select_category_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    _, _, category_code = query.data.split(":", 2)
    async with menu_state.get_lock(query.from_user.id):
        state = menu_state.get(query.from_user.id)
        state.category = category_code
        state.item_index = 0
        state.photo_index = 0
        state.show_details = False
        state.categories_mode = False
        await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer()


@router.callback_query(F.data == "m:search")
async def search_handler(query: CallbackQuery, menu_state: MenuStateStore) -> None:
    async with menu_state.get_lock(query.from_user.id):
        state = menu_state.get(query.from_user.id)
        state.awaiting_search = True
        state.categories_mode = False
    await query.message.answer("Введите текст для поиска по меню:")
    await query.answer()


@router.message(F.text)
async def search_input_handler(
    message: Message,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    async with menu_state.get_lock(message.from_user.id):
        state = menu_state.get(message.from_user.id)
        if not state.awaiting_search:
            return
        query_text = message.text.strip()
        state.search_query = query_text or None
        state.awaiting_search = False
        state.item_index = 0
        state.photo_index = 0
        state.show_details = False
        state.categories_mode = False
        logger.info("Search query set by user %s: %s", message.from_user.id, query_text)
        await render_menu(message.bot, message.chat.id, message.from_user.id, config, menu_state)


@router.callback_query(F.data == "m:reset")
async def reset_filters_handler(
    query: CallbackQuery,
    config: Config,
    menu_state: MenuStateStore,
) -> None:
    async with menu_state.get_lock(query.from_user.id):
        menu_state.reset_filters(query.from_user.id)
        await render_menu(query.bot, query.message.chat.id, query.from_user.id, config, menu_state)
    await query.answer()
