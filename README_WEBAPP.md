# Telegram Mini App (static)

## Local run

Requirements:
- Python 3.12.8+ (for simple static server)

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
