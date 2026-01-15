# Telegram Mini App (static)

## Local run

Requirements:
- Python 3.12.8+ (for simple static server)
- Node.js 20.11+ (for bundling via esbuild)

Install dependencies and build the webapp bundle:

```bash
npm install
npm run build:webapp
```

```bash
python -m http.server 8080 --directory webapp
```

Telegram requires HTTPS for Mini Apps. Use any HTTPS tunnel (cloudflared/ngrok).

## Локальный запуск бота

Минимальные требования:
- Python 3.12.8+

```bash
python -m bot.main
```

## Каталог и контент

Категории, товары, страницы и медиа управляются через `/admin`.
Данные хранятся в D1 и сразу отображаются на публичном сайте без пересборки.

## Админка

- `/admin` — полноценная админка (CRUD товаров/категорий/заказов/медиа/страниц).
- Авторизация через `ADMIN_PASSWORD_HASH` (bcrypt) или `ADMIN_PASSWORD` локально.
- Page Builder поддерживает drag&drop блоков и мгновенную публикацию.

### Как зайти в админку

1. Установите пароль:
   ```bash
   node scripts/hash-admin-password.mjs "ваш_пароль"
   ```
   Или локально задайте `ADMIN_PASSWORD=...` в `.env`.
2. Запустите Pages dev:
   ```bash
   wrangler pages dev webapp --compatibility-date=2024-10-25 --d1=DB
   ```
3. Откройте `http://localhost:8788/admin` или `/admin/login`.

## Авторизация пользователей (Telegram + Google)

WebApp внутри Telegram получает пользователя автоматически. Для обычного браузера
нужна внешняя авторизация:

1. Заполните `webapp/auth-config.js`:
   ```js
   window.PUBLIC_AUTH_CONFIG = {
     telegramBotUsername: "ваш_бот",
     googleClientId: "ваш_google_client_id",
   };
   ```
2. Добавьте переменные окружения для Pages Functions:
   - `BOT_TOKEN` — токен Telegram бота (для проверки подписи Login Widget).
   - `GOOGLE_CLIENT_ID` — OAuth Client ID (Google Identity Services).
   - `JWT_SECRET` — секрет для подписи сессионного JWT.

После этого на странице `/profile` появятся кнопки входа через Telegram и Google.

### Медиа без R2

Картинки раздаются статически из `webapp/assets`. При необходимости укажите
`PUBLIC_MEDIA_BASE_URL` (по умолчанию используется относительный путь).

## Тест-план MVP+

1. Открыть WebApp в Telegram → добавить пиццу → `/cart` → `/checkout` → cash → оформить → бот прислал подтверждение → корзина очистилась → заказ появился в профиле.
2. Повторить заказ из профиля → items вернулись в корзину.
3. Открыть WebApp в обычном браузере → добавить → checkout → оформить → заказ сохранился локально (fallback) → профиль показывает.
4. Проверить, что refresh на `/checkout` `/profile` `/admin` не даёт 404.
5. Проверить промокод: применился, total пересчитался, в заказ ушёл total корректный.
6. Админка: добавить пиццу → экспорт JSON → меню обновилось.
7. Админка: сменить статус заказа → в списке обновилось, админу/пользователю ушло уведомление (если реализовано).
