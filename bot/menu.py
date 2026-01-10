from __future__ import annotations

MENU: dict[str, dict[str, str | int]] = {
    "margarita": {
        "title": "Маргарита",
        "price": 450,
        "description": "Томатный соус, моцарелла, базилик",
        "photo_dir": "margarita",
    },
    "four_cheese": {
        "title": "Четыре сыра",
        "price": 520,
        "description": "Моцарелла, пармезан, дорблю, чеддер",
        "photo_dir": "4chees",
    },
    "cheese_bacon": {
        "title": "Сырная с беконом",
        "price": 560,
        "description": "Бекон, моцарелла, сливочный соус",
        "photo_dir": "beacon",
    },
    "sausage": {
        "title": "С колбасой",
        "price": 500,
        "description": "Колбаски, моцарелла, соус",
        "photo_dir": "kolbasa",
    },
    "sausage_mushrooms": {
        "title": "Колбаса и грибы",
        "price": 540,
        "description": "Колбаски, шампиньоны, моцарелла",
    },
    "ham_mushrooms": {
        "title": "Ветчина и грибы",
        "price": 540,
        "description": "Ветчина, шампиньоны, моцарелла",
    },
}
