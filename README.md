# GREEN-API Telegram-чат

Тестовое задание «Фронтенд-разработчик React»: веб-чат для отправки и получения текстовых
сообщений Telegram через [GREEN-API](https://green-api.com/). Backend нет — запросы идут
из браузера.

Статус: **этап 4 из 6 — чаты и отправка**. Форма логина проверяет инстанс
(`getStateInstance`), при необходимости включает настройки уведомлений и сохраняет креды в
`localStorage`. На экране чата: новый чат по номеру телефона (`checkAccount`; уже известный
номер открывается без запроса), отправка текста со статусами «отправляется» / «отправлено» /
«не отправлено · Повторить», удаление чата с историей. Чаты и сообщения хранятся в
`localStorage` и синхронизируются между вкладками; «Выйти» стирает креды и все данные. На
узком экране — либо список, либо окно чата. Получение ответов — этап 5.
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
`app` (провайдеры, стили, выбор экрана, очистка данных при логауте), `pages/login`,
`pages/chat` (сайдбар, окно чата и их модели — код с одним потребителем живёт в странице),
`features/auth` (форма логина, «Выйти»), `features/delete-chats` (удаление чатов с
историей), `entities/session` (креды, `logout`, клиент API), `entities/chat`,
`entities/message`, `shared/api` (клиент GREEN-API), `shared/config` (срок хранения
данных), `shared/ui` (заголовок приложения); `widgets` пока нет. Тестовые утилиты — в `test/` и `vitest.setup.ts` вне `src/`.
