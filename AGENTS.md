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
- Новый слайс подключать к потребителю в том же этапе: `fsd/insignificant-slice` роняет
  steiger для слайса без ссылок или с одной ссылкой из другого слайса; одна ссылка только из
  `app` — допустима, слайсы `pages` правило не проверяет. Слайс без `index.ts` роняет
  `fsd/public-api`.
- Pages-first: код с одним потребителем (виджеты, фичи страницы) живёт в самой странице
  (`pages/chat/model`, `pages/chat/ui`) и выносится в слой, когда появится второй
  потребитель.
- Общее для нескольких фич состояние — в `entities` (креды, `logout`, `greenApiAtom` —
  `entities/session`).
- Сущности друг друга не импортируют: у каждой атомарные экшены, связку делает фича
  (`features/delete-chats`: чат + его сообщения).
- Очистка данных при логауте — `src/app/user-data-cleanup.ts` (`withChangeHook` на
  `credentialsAtom` → `deleteAllChats()`): срабатывает на любой логаут, в т.ч. из другой
  вкладки. Новые данные пользователя чистить там же, не в `logout`.
- steiger не видит `export * from "…"`: такой re-export через границу слоя не ловится —
  писать `import`.
- В `app` нет сегмента `ui` (`fsd/no-ui-in-app`): компоненты уровня приложения (`Screen`)
  живут прямо в `src/app/app.tsx`.

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
  заводить. Ключ — `ga.<name>`. `time` по умолчанию ~24,8 суток (потом запись просрочена):
  для долгоживущих данных — `time: PERSIST_TTL` из `@/shared/config` (10 лет; не
  `Infinity` — в JSON это `null`). Хранилище значение не проверяет — форму проверять в
  `fromSnapshot`. Тест persist — круговой путь через новый кадр `context.start()`, формат
  `PersistRecord` не проверять.
- `withLocalStorage` по умолчанию подписан на `storage` (синхронизация вкладок) и вызывает
  `fromSnapshot` и после собственных записей атома: в нём только проверка формы, без
  преобразований (корректный снапшот — тот же объект). `subscribe: false` — без синхронизации
  (так у `activeChatIdAtom`: выбор чата у вкладки свой).

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
- Общие UI-компоненты — сегмент `src/shared/ui` (файлы плоско, публичный API — `index.ts`):
  например, `AppTitle` — название приложения как `h1` страницы.
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
- Формы — `reatomForm` + `bindField(field)` из `@reatom/react` на инпутах Mantine
  (`<TextInput {...bindField(field)} />`). Логика сабмита — целиком в `onSubmit`; повторный
  сабмит отменяет предыдущий, явная отмена — `submit.abort()`; лоадер и ошибка —
  `submit.ready()`/`submit.error()`. `signal` для запросов — `abortVar.subscribe()`
  (`unsubscribe()` в `finally`), каждый `await` — через `wrap()`. `form.reset()` вне сабмита
  тоже отменяет его. `submit.error()` живёт до следующего успешного сабмита
  (`resetError: "onFulfill"`); отмена туда не попадает. Провал валидации отклоняет `submit`
  той же ошибкой, что в `form.validation.trigger.error()`, — отличать её по тождеству.
- Валидатор-функция поля выполняется в `effect`: чтение другого атома в нём — через
  `peek`, иначе поле перепроверяется при каждом изменении того атома.
- Обработчики событий: в `reatomComponent` — `wrap(handler)`, в обычном компоненте —
  `useWrap(handler)`; иначе вызов атома вне кадра.
- Тосты (`notifications.show` из `@mantine/notifications`) вызываются прямо из модели.
- `withChangeHook` выполняется в кадре изменения, но не синхронно — в фазе хуков: сразу
  после `logout()` данные ещё старые, после `notify()`/микротаска — очищены.
- Логаут не сбрасывает кадр и не отменяет запросы в полёте (`reatomComponent` тоже не
  отменяет при размонтировании): после `await` сверять, что `greenApiAtom()` — тот же
  клиент, иначе ничего не записывать. Патч-экшены по неизвестному ключу — no-op, ключ не
  создают.
- Экшен, вызываемый без `await` (`sendChatMessage`), не должен отклоняться (ни ошибкой, ни
  отменой): при сбросе кадра это был бы unhandled rejection. Долгую операцию, которую не
  должна отменять повторная отправка, делать обычным `action`, не `onSubmit` формы.
- Таймаут запроса — `setTimeout` + `AbortController` с причиной `TimeoutError`, не
  `AbortSignal.timeout()` (не подчиняется fake timers). `isAbort` узнаёт только
  `AbortError`, поэтому таймаут — ошибка, а не отмена.
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
  отмены). `respondByMethod({ getStateInstance: { body }, ... })` — ответ по имени метода
  из URL (неожиданный метод роняет тест), `calledMethods()` — список вызванных методов.
  `deferFetch()` — каждый вызов ждёт `resolveNext(body, status?)`/`rejectNext(error)`,
  `pending()` — число ждущих, отмена — с `signal.reason` (состояние «до ответа», логаут
  посреди запроса).
- Примеры ответов GREEN-API — `.ts`-фикстуры в `test/fixtures/green-api/`:
  `export const x = { ... } satisfies <Тип>`, данные из документации (вымышленные).
  `tsc -b` сверяет их с типами.
- В тестах моделей после `field.change(...)` вызывать `notify()` из `@reatom/core`: хуки
  поля (сброс ошибки) идут микротаском и иначе сотрут ошибки посреди сабмита. Так же — после
  действий, от которых срабатывают `withChangeHook` (`logout`, смена активного чата).
- Тосты: в тестах компонентов — по тексту, в `afterEach` — `notifications.clean()`, иначе
  очередь тостов утекает в следующий тест; в тестах моделей без рендера —
  `vi.spyOn(notifications, "show")`.
- Шпионы `vi.spyOn` восстанавливаются сами перед каждым тестом (`test.restoreMocks: true` в
  `vite.config.ts`); `mockRestore()` вручную не вызывать.
- Исключения: `App` и `ReatomProvider` содержат свои провайдеры и рендерятся обычным
  `render` из RTL.
- `vitest.setup.ts`: `clearStack()`, очистка `localStorage`/`sessionStorage` после
  каждого теста, моки jsdom для Mantine, глобальный `DOMException` из Node (у jsdom он не
  `instanceof Error`, и `isAbort()` Reatom не узнавал бы отмену). DOM-API jsdom по-прежнему
  бросают свой `DOMException`: для них `instanceof DOMException`/`toThrow(DOMException)`
  ложны — проверять `error.name`.

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
