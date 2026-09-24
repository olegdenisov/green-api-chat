# GREEN-API Telegram-чат

Тестовое задание «Фронтенд-разработчик React»: веб-чат для отправки и получения текстовых
сообщений Telegram через [GREEN-API](https://green-api.com/). Backend нет — запросы идут
из браузера.

Статус: **этап 1 из 6 — скаффолд**. Настроены стек, инструменты качества и FSD-скелет;
приложение пока показывает заглушку. Дизайн, API, модель данных и этапы:
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

Креды инстанса (`idInstance`, `apiTokenInstance`) будут вводиться в форме логина
(этап 3) — `.env` не нужен.

## Структура

[Feature-Sliced Design](https://feature-sliced.design/): слои в `src/` — `app` → `pages`
→ `widgets` → `features` → `entities` → `shared`, импорт только сверху вниз. Сейчас есть
только `app` (провайдеры, стили) и `pages/home` (заглушка); остальные слои появятся на
следующих этапах. Тестовые утилиты — в `test/` и `vitest.setup.ts` вне `src/`.
