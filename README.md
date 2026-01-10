# Tgbot

## Setup Termux

Минимальные требования:
- Python 3.12.12
- Termux (Android)

### Установка

```bash
pkg update && pkg upgrade
pkg install python git
python -m venv .venv
. .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

### Переменные окружения (.env)

Создайте файл `.env` в корне проекта:

```env
BOT_TOKEN=123456:ABCDEF
ADMIN_CHAT_ID=123456789
DB_PATH=/data/data/com.termux/files/home/pizza-bot/bot.db
YOOKASSA_SHOP_ID=123456
YOOKASSA_SECRET_KEY=test_...
YOOKASSA_RETURN_URL=https://t.me/your_bot
```

### Как получить ADMIN_CHAT_ID

1. Напишите любому боту, например `@userinfobot`.
2. Скопируйте `Id` из ответа.

### Запуск

```bash
python -m bot.main
```
