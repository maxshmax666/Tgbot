# Telegram Mini App (static)

## Local run

Requirements:
- Python 3.10+ (for simple static server)

```bash
python -m http.server 8080 --directory webapp
```

Telegram requires HTTPS for Mini Apps. Use any HTTPS tunnel (cloudflared/ngrok).

## Добавление пиццы

1. Обновите `webapp/data/menu.json` (структура: `id`, `slug`, `title`, `price`, `desc`, `photosCount`, `tags`, `isAvailable`).
2. Добавьте фото в `webapp/assets/pizzas/<slug>/<slug>_01.jpg ... _0N.jpg`.
3. Перезагрузите страницу или очистите кеш.

## Админка

- Открыть `/admin` в WebApp.
- Доступ: Telegram user ID из `webapp/data/config.json` (`adminTgId`) или PIN (`adminPinHash`).
- Действия админки сохраняются локально в `localStorage`, для синхронизации используйте кнопку "Синхронизировать с ботом".

PIN задаётся как SHA-256 hash строки (можно сгенерировать любым онлайн/локальным хэшером).

## Тест-план MVP+

1. Открыть WebApp в Telegram → добавить пиццу → `/cart` → `/checkout` → cash → оформить → бот прислал подтверждение → корзина очистилась → заказ появился в профиле.
2. Повторить заказ из профиля → items вернулись в корзину.
3. Открыть WebApp в обычном браузере → добавить → checkout → оформить → заказ сохранился локально (fallback) → профиль показывает.
4. Проверить, что refresh на `/checkout` `/profile` `/admin` не даёт 404.
5. Проверить промокод: применился, total пересчитался, в заказ ушёл total корректный.
6. Админка: добавить пиццу → экспорт JSON → меню обновилось.
7. Админка: сменить статус заказа → в списке обновилось, админу/пользователю ушло уведомление (если реализовано).
