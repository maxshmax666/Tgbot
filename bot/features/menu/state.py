from __future__ import annotations

import asyncio
from dataclasses import dataclass


@dataclass
class MenuState:
    message_id: int | None = None
    chat_id: int | None = None
    item_index: int = 0
    photo_index: int = 0
    category: str | None = None
    search_query: str | None = None
    show_details: bool = False
    awaiting_search: bool = False
    categories_mode: bool = False
    in_cart: bool = False


class MenuStateStore:
    def __init__(self) -> None:
        self._states: dict[int, MenuState] = {}
        self._locks: dict[int, asyncio.Lock] = {}

    def get(self, user_id: int) -> MenuState:
        if user_id not in self._states:
            self._states[user_id] = MenuState()
        return self._states[user_id]

    def reset_filters(self, user_id: int) -> None:
        state = self.get(user_id)
        state.category = None
        state.search_query = None
        state.item_index = 0
        state.photo_index = 0
        state.show_details = False
        state.categories_mode = False

    def get_lock(self, user_id: int) -> asyncio.Lock:
        if user_id not in self._locks:
            self._locks[user_id] = asyncio.Lock()
        return self._locks[user_id]
