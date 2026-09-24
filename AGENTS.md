# AGENTS.md

Инструкции для AI-агентов. Единый источник: `CLAUDE.md` подключает этот файл.

## Проект

Тестовое задание «Фронтенд-разработчик React»: веб-чат для отправки и получения текстовых
сообщений Telegram через GREEN-API. Backend нет — запросы идут из браузера.

Дизайн, API, модель данных и этапы: [docs/plans/20260923-telegram-chat-design.md](docs/plans/20260923-telegram-chat-design.md).

## Стек

- Vite + React + TypeScript, pnpm, Node >= 22 (разработка на Node 24).
- Состояние: Reatom v1001 (`@reatom/core`, `@reatom/react`).
- UI: Mantine 9 + CSS Modules.
- Тесты: Vitest + Testing Library (jsdom).
- Качество: oxlint, oxfmt, steiger (линтер FSD).

## Архитектура: Feature-Sliced Design

Слои в `src/`: `app` → `pages` → `widgets` → `features` → `entities` → `shared`.

- Импорт только сверху вниз: слой импортирует лишь нижележащие слои.
- Доступ к слайсу — только через его публичный `index.ts`.
- Слайсы одного слоя не импортируют друг друга (в частности, фичи).
- Пустые слои и сегменты не создавать.
- Границы проверяет steiger.

## GREEN-API

- URL: `{apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}` (сегмент `waInstance`
  и для Telegram).
- `chatId` в Telegram — число строкой, без `@c.us`.
- Входящие — через очередь уведомлений (`receiveNotification` + `deleteNotification`).
- Подробности, ошибки и принятые решения — в дизайн-документе.

## Правила

- Версии, CLI-флаги, конфиги и API библиотек сверять по актуальной документации, `--help`
  и npm, а не по памяти.
- Креды (`idInstance`, `apiTokenInstance`) и `.env*` не коммитить. Перед коммитом проверять
  `git status`.
- Планы этапов — в `docs/plans/`, по одному файлу на этап.

## Команды

TBD — появятся в Task 3/8 плана `docs/plans/20260923-01-scaffold.md`.
