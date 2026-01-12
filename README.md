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

## Cloudflare Pages (WebApp + Admin API)

Минимальные требования:
- Node.js 18+
- Wrangler 3+

### 1) Настройка окружения

```bash
cp .env.example .env
```

Обязательные переменные для админки/функций:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `R2_PUBLIC_URL`

Для бота используйте `WEBAPP_URL=https://tgbot-3cm.pages.dev/`.

### 2) D1 база данных

Создать базу и применить схему:

```bash
wrangler d1 create tgbot_db
wrangler d1 execute tgbot_db --file=./schema.sql
```

Скопируйте `database_id` в `wrangler.toml`.

### 3) R2 bucket

```bash
wrangler r2 bucket create tgbot-media
```

Публичный URL укажите в `R2_PUBLIC_URL` (например, `https://<account>.r2.dev/tgbot-media`).

### 4) Локальная разработка

WebApp + Pages Functions:

```bash
wrangler pages dev webapp --compatibility-date=2024-10-25 --d1=DB --r2=MEDIA_BUCKET
```

WebApp отдельно (без функций):

```bash
python -m http.server 8080 --directory webapp
```

### 5) Деплой

Подключите репозиторий к Cloudflare Pages и укажите:
- **Build command:** не требуется
- **Output directory:** `webapp`
- **Functions directory:** `functions`
- **Environment variables:** `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`, `R2_PUBLIC_URL`

### 6) Админка

Админка доступна по `/admin`. При первом запросе создаётся владелец из `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
