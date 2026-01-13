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
MINIAPP_URL=https://tgbot-3cm.pages.dev/
```

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
- `ADMIN_PASSWORD_HASH`
- `ADMIN_PASSWORD` (локально вместо хэша)
- `JWT_SECRET`
- `PUBLIC_MEDIA_BASE_URL` (опционально, если ассеты не на том же домене)

Для бота используйте `MINIAPP_URL=https://tgbot-3cm.pages.dev/`.

### 2) D1 база данных

Создать базу и применить схему:

```bash
wrangler d1 create tgbot_db
wrangler d1 execute tgbot_db --file=./schema.sql
```

Сохраните `database_id` в настройках проекта Cloudflare Pages (D1 binding).

### 3) Локальная разработка

WebApp + Pages Functions:

```bash
wrangler pages dev webapp --compatibility-date=2024-10-25 --d1=DB
```

WebApp отдельно (без функций):

```bash
python -m http.server 8080 --directory webapp
```

### 4) Деплой

Подключите репозиторий к Cloudflare Pages и укажите:
- **Root directory:** `/`
- **Build command:** `npm ci`
- **Build output directory:** `webapp`
- **Functions directory:** `functions`
Конфигурация Pages задается в UI, `wrangler.toml` не используется.

Production checklist (env):
- [ ] `ADMIN_PASSWORD_HASH`
- [ ] `JWT_SECRET`
- [ ] `PUBLIC_MEDIA_BASE_URL` (опционально, если ассеты не на том же домене)

### 5) Админка

Админка доступна по `/admin`. Авторизация выполняется через пароль из `.env`.

#### Как задать пароль

1. Сгенерируйте bcrypt-хэш:
   ```bash
   node scripts/hash-admin-password.mjs "ваш_пароль"
   ```
2. Запишите хэш в `.env`:
   ```env
   ADMIN_PASSWORD_HASH=...
   ```
   Или используйте `ADMIN_PASSWORD=...` локально (plain-text).
3. Перезапустите сервер/билд и откройте `/admin/login`.

### 6) Health check

`GET /api/health` → `{ ok: true }`.
