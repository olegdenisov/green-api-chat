# AGENTS.md

Инструкции для AI-агентов. Единый источник: `CLAUDE.md` подключает этот файл.

## Проект

Тестовое задание «Фронтенд-разработчик React»: веб-чат для отправки и получения текстовых
сообщений Telegram через GREEN-API. Backend нет — запросы идут из браузера.

Дизайн, API, модель данных и этапы: [docs/plans/20260923-telegram-chat-design.md](docs/plans/20260923-telegram-chat-design.md).

## Стек

- Vite 8 + React 19 + TypeScript 6, pnpm, Node >= 22 (разработка на Node 24).
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

### `shared/api`

- `src/shared/api` — сегмент слоя `shared` (без слайсов). Файлы лежат плоско; папки
  `ui`/`api`/`lib`/`model`/`config` внутри сегмента запрещает steiger
  (`fsd/no-reserved-folder-names`). Публичный API — `index.ts`; внутренний `request()`
  наружу не экспортируется.
- `createGreenApi(creds)` — фабрика клиента с 7 методами; экземпляр без состояния, при смене
  кредов создаётся новый. `request()` — единственное место с `fetch`.
- Ошибки — `ApiError` с `kind`: `auth` (`401`/`403`), `network` (сбой `fetch`/чтения тела,
  причина в `cause`), `rate-limit` (`469` и `rate_limit_exceeded` в `200` у `checkAccount`),
  `http` (прочие статусы, битый JSON, пустое тело там, где оно обязательно). `message` — без
  URL и токена.
- Отмена: все методы принимают `{ signal }`; при отменённом `signal` пробрасывается
  `signal.reason` (не `ApiError`) — чтобы работала отмена Reatom.
- Форматы запросов/ответов сверять по https://green-api.com/telegram/docs/ (страницы
  методов), не по WhatsApp-версии; новые примеры — фикстурами в `test/fixtures/green-api/`
  с `satisfies`.
- Типы ответов и уведомлений — `types.ts`, по документации Telegram; рантайм-валидации нет.
  Union уведомлений без «ловушки»: неизвестные `typeWebhook`/`typeMessage` — ветка `default`.
- Persist атомов — встроенный `withLocalStorage` из `@reatom/core`; `shared/lib` под это не
  заводить.

## Инструменты

- oxlint (`.oxlintrc.json`): правила хуков и react-refresh — в плагине `react`
  (`react/exhaustive-deps` — ошибка через категорию `correctness`;
  `react/rules-of-hooks` включено явно в `.oxlintrc.json`; `react/only-export-components`, выключено для тестов); отдельных
  плагинов нет. Запуск с `--deny-warnings`.
- oxfmt (`.oxfmtrc.json`): стиль по умолчанию — двойные кавычки, точки с запятой;
  форматирует и корневые `.md`. `docs/` игнорируется.
- steiger (`steiger.config.ts`): `fsd.configs.recommended`; `fsd/segments-by-purpose`
  отключено только для `src/app/providers/**`. Новые исключения не добавлять без причины.
- Алиасы: `@/*` → `src/*`, `@test/*` → `test/*` (из tsconfig через `resolve.tsconfigPaths`).
- `dist/`, `coverage/` oxlint и oxfmt пропускают сами — они читают `.gitignore`.
- TypeScript 6 нарушает peer `typescript ^5` у `tsconfck` (через steiger; он резолвит
  алиасы). Пока работает. После изменений tsconfig проверять: временное нарушение FSD
  (например, импорт `@/app/...` из `pages`) должно ронять `make lint-fsd`.

## Стили

- Глобальный CSS подключается только в `src/app/app.tsx`, в порядке: `@mantine/core/styles.css`
  → `@mantine/notifications/styles.css` → `./styles/index.css`. Так CSS Modules
  перекрывают стили Mantine.
- Вёрстка — CSS Modules (`*.module.css`) рядом с компонентом.
- PostCSS (`postcss.config.cjs`, как в гайде Mantine для Vite): миксины
  `postcss-preset-mantine` (`@mixin hover`, `light`/`dark`, `rem()`) и переменные
  `$mantine-breakpoint-xs…xl` для `@media`.

## Reatom

- Версия v1001 — API сильно отличается от старых. Писать по skill `reatom` / `reatom-async`
  и документации, не по памяти.
- `clearStack()` вызывается в `src/main.tsx` и в `vitest.setup.ts`: глобального контекста
  нет, всё выполняется в кадре провайдера или через `wrap()`, иначе ошибка
  `missing async stack`.
- `ReatomProvider` создаёт свой кадр (`context.start()`) на каждый экземпляр.
- `connectLogger` включён только при `MODE === "development"` (`make dev`, не в тестах) —
  основной инструмент отладки. Атомы и экшены именовать (`atom(0, "chat.list")`), иначе в
  логе они безымянные.
- Логгер подключается в `src/app/logger.ts`, и этот модуль — первый импорт в
  `src/main.tsx` (до `@/app/app`). `connectLogger()` расширяет только атомы, созданные
  после вызова (без back-fill), а атомы моделей создаются при вычислении их модулей.
  Вызов в теле `main.tsx` или в провайдере — уже поздно: атомы из `pages`/`features`/
  `entities` в логе не появятся.

## Тесты

- Vitest, globals выключены: `describe`/`it`/`expect` импортировать из `vitest`.
- Тесты лежат рядом с кодом: `*.test.ts` / `*.test.tsx`.
- Компоненты рендерить через `render` из `@test/render`: `StrictMode`, свежий
  Reatom-контекст (`context.start()`) на каждый рендер, `MantineProvider env="test"` с
  `<Notifications />`. Возвращает `frame` для чтения атомов:
  `frame.run(() => someAtom())`. `screen` и пр. — из `@testing-library/react`.
- После каждого теста кадры рендеров сбрасываются (`context.reset()`): `wrap()`-колбэки и
  промисы этих кадров отменяются, таймеры не утекают в следующий тест.
- Тесты без рендера: код с атомами — внутри `context.start(() => ...)` (свой кадр на
  тест); вызов атома вне кадра бросает ошибку, как в проде.
- Взаимодействия — через `userEvent.setup()`, не `fireEvent`.
- `fetch` мокать через `vi.stubGlobal("fetch", vi.fn<typeof fetch>())`; снимать вручную не
  нужно — в `vite.config.ts` включено `test.unstubGlobals: true`. Для клиента GREEN-API —
  хелпер `@test/green-api`: `beforeEach(stubFetch)`, `respond`/`respondJson`, `creds`/`TOKEN`/
  `BASE`; `hangUntilAbort()` — мок, который отклоняется с `signal.reason` при отмене (тесты
  отмены).
- Примеры ответов GREEN-API — `.ts`-фикстуры в `test/fixtures/green-api/`:
  `export const x = { ... } satisfies <Тип>`, данные из документации (вымышленные).
  `tsc -b` сверяет их с типами.
- Исключения: `App` и `ReatomProvider` содержат свои провайдеры и рендерятся обычным
  `render` из RTL.
- `vitest.setup.ts`: `clearStack()`, очистка `localStorage`/`sessionStorage` после
  каждого теста, моки jsdom для Mantine.

## Правила

- Версии, CLI-флаги, конфиги и API библиотек сверять по актуальной документации, `--help`
  и npm, а не по памяти.
- Креды (`idInstance`, `apiTokenInstance`) и `.env*` не коммитить. Перед коммитом проверять
  `git status`.
- Планы этапов — в `docs/plans/`, по одному файлу на этап.

## Команды

`Makefile` — тонкая обёртка над скриптами `package.json`; логика только в скриптах.
Полный список целей — `make help`.

- `make install` — установить зависимости.
- `make dev` — dev-сервер; `make build` — сборка; `make preview` — просмотр сборки.
- `make test` — тесты один раз; `make test-watch` — в watch-режиме.
- `make lint`, `make format`, `make format-check`, `make lint-fsd`, `make typecheck`.
- `make check` — lint → format-check → lint-fsd → typecheck → test. Должен быть зелёным
  перед каждым коммитом.
- `make clean` — удалить `dist`, `coverage`, `node_modules/.vite`.
