from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MenuItem:
    code: str
    name: str
    price: int


MENU_ITEMS: tuple[MenuItem, ...] = (
    MenuItem(code="margarita", name="Маргарита", price=450),
    MenuItem(code="four_cheese", name="Четыре сыра", price=520),
    MenuItem(code="cheese_bacon", name="Сырная с беконом", price=560),
    MenuItem(code="sausage", name="С колбасой", price=500),
    MenuItem(code="sausage_mushrooms", name="Колбаса и грибы", price=540),
    MenuItem(code="ham_mushrooms", name="Ветчина и грибы", price=540),
)

MENU_BY_CODE = {item.code: item for item in MENU_ITEMS}
