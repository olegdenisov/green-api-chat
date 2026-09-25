# GREEN-API Telegram-чат

Тестовое задание «Фронтенд-разработчик React»: веб-чат для отправки и получения текстовых
сообщений Telegram через [GREEN-API](https://green-api.com/). Backend нет — запросы идут
из браузера.

Статус: **этап 3 из 6 — вход**. Форма логина проверяет инстанс (`getStateInstance`),
при необходимости включает настройки уведомлений (тост: входящие начнут приходить в течение
~5 минут) и сохраняет креды в `localStorage` (`ga.credentials`). После перезагрузки
залогиненный пользователь сразу видит экран чата (пока заглушка); «Выйти» стирает креды.
Дизайн, API, модель данных и этапы:
[docs/plans/20260923-telegram-chat-design.md](docs/plans/20260923-telegram-chat-design.md).

## Стек

- Vite 8, React 19, TypeScript 6
- Reatom v1001 (`@reatom/core`, `@reatom/react`) — состояние
- Mantine 9 + CSS Modules — UI
- Vitest 5 + Testing Library (jsdom) — тесты
- oxlint, oxfmt, steiger (линтер FSD) — качество

## Требования

- Node.js >= 22
- pnpm (версия зафиксирована в `packageManager`, удобно через Corepack)

## Запуск

```sh
make install   # зависимости
make dev       # dev-сервер Vite
make check     # lint → format-check → lint-fsd → typecheck → test
make help      # все команды
```

Креды инстанса (`idInstance`, `apiTokenInstance`, при необходимости `apiUrl`) вводятся в
форме логина — `.env` не нужен.

## Структура

[Feature-Sliced Design](https://feature-sliced.design/): слои в `src/` — `app` → `pages`
→ `widgets` → `features` → `entities` → `shared`, импорт только сверху вниз. Сейчас есть
`app` (провайдеры, стили, выбор экрана), `pages/login`, `pages/chat` (заглушка),
`features/auth` (форма логина, «Выйти»), `entities/session` (креды, `logout`) и
`shared/api` (клиент GREEN-API); `widgets` появятся на следующих этапах. Тестовые утилиты — в `test/` и `vitest.setup.ts` вне `src/`.
