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
  `credentialsAtom` → `deleteAllChats()` и `resetChatPage()` — форма нового чата (сброс и закрытие) и черновик;
  `withInitHook`: кредов нет при старте → `deleteAllChats()`): срабатывает на любой логаут,
  в т.ч. из другой вкладки. Новые данные пользователя чистить там же, не в `logout`. Хук
  регистрируется side-effect импортом в `app.tsx`; в тестах без `App` очистки нет —
  импортировать `@/app/user-data-cleanup` в тесте, если она нужна (из `app`-тестов).
- Фоновая работа, живущая, пока есть креды, — `features/receive-messages`: опрос очереди
  уведомлений запускает `withConnectHook` на `pollingAtom`; подписчик — только безголовый
  `ReceiveMessages` (рендерит `Screen` в `app.tsx` рядом с `ChatPage`). `ConnectionIndicator`
  в `ChatPage` читает `receiveStatusAtom` — простой атом без хука, опрос не запускает.
  Логаут размонтирует экран — отключение отменяет опрос. Публичный API слайса — только
  `ReceiveMessages` и `ConnectionIndicator`; атомы статуса и опроса внутренние — в тестах
  `app`/`pages` состояние `reconnecting` получать через ошибки `fetch`, не прямой записью.
- steiger не видит `export * from "…"`: такой re-export через границу слоя не ловится —
  писать `import`.
- В `app` нет сегмента `ui` (`fsd/no-ui-in-app`): компоненты уровня приложения (`Screen`)
  живут прямо в `src/app/app.tsx`.

## GREEN-API

- URL: `{apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}` (сегмент `waInstance`
  и для Telegram).
- `chatId` в Telegram — число строкой, без `@c.us`.
- Входящие — через очередь уведомлений (`receiveNotification` + `deleteNotification`).
- Статусы доставки исходящих — уведомление `outgoingMessageStatus`; требует флаг
  `outgoingWebhook` (включается вместе с прочими webhook-флагами в `setSettings` при логине,
  только при логине — у сохранённой сессии не проверяется). Обрабатываются только
  `delivered`/`read` (оба приходят с `idMessage`); `failed`/`noAccount` в документации — без
  `idMessage`, сообщение не сопоставить, событие просто удаляется из очереди.
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
- Отмена: все методы принимают `{ signal, timeout }`; при отменённом `signal` пробрасывается
  `signal.reason` (не `ApiError`) — чтобы работала отмена Reatom. `timeout` (мс) — таймаут
  запроса: `request()` сам объединяет его с `signal` и бросает `TimeoutError`; вручную
  сигналы и таймеры в моделях не объединять (так `deliver()` и цикл опроса).
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

## CI и деплой

- CI — `.github/workflows/ci.yml`: на push в `main` и PR, Node 24, два параллельных job'а —
  `check` (`make lint`, `format-check`, `lint-fsd`, `typecheck`, `build`) и `test`
  (`make test`). Матрицы версий Node нет. Деплой Vercel (Git-интеграция) от CI не зависит.
- `vercel.json`: пресет `vite`, `installCommand`/`buildCommand` с `corepack enable` (Vercel по
  lockfile ставит pnpm 9/10, проект — pnpm 12), заголовки: CSP (`script-src 'self'`),
  `Referrer-Policy`, `X-Content-Type-Options`. Поэтому в `index.html` не должно быть
  inline-скриптов; `connect-src https:` — `apiUrl` задаёт пользователь. Менять CSP — вместе
  с этим файлом. Деплой — https://green-api-chat-three.vercel.app/: заголовки отдаются,
  страница грузится без нарушений CSP; запросы к GREEN-API с домена деплоя не проверены.

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
- Вёрстка — CSS Modules (`*.module.css`) рядом с компонентом. Цвета — только переменные
  Mantine и `--ga-*` из темы, хардкода цветов в модулях нет.
- Тема — `src/app/providers/theme.ts`: `createTheme` — палитра `dawn` (`primaryColor`,
  `primaryShade: { light: 7, dark: 6 }`), основана на палитре №4705 с color.romanuke.com
  (индиго `#3c487c`, лаванда `#797eba`, персик `#f8d4c4`, пудровый розовый `#e5b1b9`) —
  заменила прежний синий акцент «по мотивам web.max.ru»; своя тёмная шкала `dark` с оттенком
  индиго вместо нейтральной шкалы Mantine, чтобы хром и лента были из одного семейства.
  `cssVariablesResolver` задаёт токены `--ga-*` (одинаковые в обеих схемах — в `variables`,
  различающиеся — в `light`/`dark`): фон ленты (`--ga-feed-bg`),
  пузыри входящих/исходящих (`--ga-bubble-in-*`/`--ga-bubble-out-*`, включая `-meta`), мягкая
  ошибка отправки (`--ga-bubble-failed-bg`/`-border`/`-text`/`-meta` — розовый тинт с рамкой,
  не сплошная заливка), цвет «прочитано» (`--ga-status-read`), разделитель дня
  (`--ga-day-bg`/`-text`), полоса статуса соединения (`--ga-notice-bg`/`-text`; те же значения,
  что у разделителя дня, но отдельный токен — `features` не зависит от детали `pages`), активная строка списка (`--ga-row-active-bg`/`-bar`/`-time` — тинт
  и полоса слева, не сплошная заливка), disabled-кнопка отправки
  (`--ga-send-disabled-bg`/`-icon`) и пять пар аватарных токенов
  (`--ga-avatar-{1..5}-bg`/`-fg`, цвет по хешу `chatId`, применяются через `vars` на `Avatar`).
  Там же переопределены `--mantine-color-text`, `--mantine-color-dimmed` (контраст),
  `--mantine-color-body`, `--mantine-color-default-border`/`-hover`. Тест темы (`theme.test.ts`)
  сверяет, что ключи `light`/`dark` совпадают и не повторяют ключи `variables`. `UiProvider`: `defaultColorScheme="auto"` —
  схема по системной, переключателя нет. Скрипта схемы нет: до монтирования `MantineProvider`
  схему подхватывает CSS в `src/app/styles/index.css` (селектор
  `:root:not([data-mantine-color-scheme])`) — там же и в `index.html` (`theme-color`) и
  `public/favicon.svg` цвета для тёмной схемы и логотипа продублированы (не через CSS-переменные,
  комментарий в `index.css` о дублировании). `render` из `@test/render` тему не получает.
- Иконки — свои инлайн-SVG в `src/shared/ui/icons.tsx` (`aria-hidden`, имя — у кнопки через
  `aria-label`); новых зависимостей и веб-шрифтов нет.
- Общие UI-компоненты — сегмент `src/shared/ui` (файлы плоско, публичный API — `index.ts`):
  например, `AppTitle` — название приложения как `h1` страницы.
- `src/shared/config` — сегмент без слайсов, файлы плоско (`persist.ts` — `PERSIST_TTL`),
  публичный API — `index.ts`.
- PostCSS (`postcss.config.cjs`, как в гайде Mantine для Vite): миксины
  `postcss-preset-mantine` (`@mixin hover`, `light`/`dark`, `rem()`) и переменные
  `$mantine-breakpoint-xs…xl` для `@media`.
- A11y: у кнопок-иконок (`ActionIcon`) имя — `aria-label`, в т.ч. «+» нового чата
  (`aria-label="Новый чат"`, `aria-expanded`, `aria-controls` на всегда смонтированную обёртку
  формы, `sidebar.tsx`). Статус сообщения в пузыре — `role="img"` + `aria-label`
  («Отправляется», «Отправлено», «Доставлено», «Прочитано», «Не отправлено»; `span` без роли
  `aria-label` не поддерживает, сам SVG остаётся `aria-hidden`). Тесты ищут элементы по
  ролям/именам, не по классам. Единственный landmark `<main>` — `.page` в `ChatPage`
  (`ChatWindow` — обычный `div`). Фокус в `ChatPage` (один эффект на переход `activeChatId` и на закрытие формы нового
  чата; срабатывает только если фокус потерян — упал на `<body>`, потому что элемент
  размонтировался, или остался на элементе, который больше не отрисован: `checkVisibility()`
  === `false`, без него (Safari < 17.4, jsdom) — только `<body>`; фокус на видимом элементе не
  трогается):
  - уход из чата (кнопка «Назад» или удаление чата через `DeleteChatButton`, `activeChatId` →
    `null`) — на строку закрытого чата в `nav` (`[data-chat-id]`) или, если строки нет (чат
    удалён), на сам `nav` (`tabIndex={-1}`, `sidebar.tsx`);
  - открытие чата или закрытие формы при открытом чате (успешный сабмит формы нового чата, в
    т.ч. номером уже открытого чата — тогда меняется только форма) — в поле «Сообщение»
    композера (`[data-composer-input]` в корне страницы). На узком экране клик по
    строке скрывает колонку списка (`display: none`), но эффект React для клика выполняется
    до того, как браузер уведёт фокус со скрытой строки на `<body>`: поэтому и нужна проверка
    `checkVisibility`. jsdom её не реализует — тест ставит стаб на
    `Element.prototype.checkVisibility`.

  Форма нового чата: «+» открывает и переносит фокус в поле номера; Escape (`onKeyDown` на
  обёртке) или повторный «+» — `createChatForm.reset()` (отменяет запрос в полёте), форма
  закрывается, фокус — обратно на «+».

  Mantine `Popover` в `DeleteChatButton` — свой `returnFocus` для Escape/«Отмена» (кнопка
  остаётся в DOM); строки чатов — обычные `<button data-chat-id>` с `aria-current`, не
  `NavLink`.

## Reatom

- Версия v1001 — API сильно отличается от старых. Писать по skill `reatom` / `reatom-async`
  и документации, не по памяти.
- `clearStack()` вызывается в `src/main.tsx` и в `vitest.setup.ts`: глобального контекста
  нет, всё выполняется в кадре провайдера или через `wrap()`, иначе ошибка
  `missing async stack`.
- `ReatomProvider` создаёт свой кадр (`context.start()`) на каждый экземпляр.
- `connectLogger` включён только при `MODE === "development"` (`make dev`, не в тестах) —
  основной инструмент отладки. Атомы и экшены именовать (`atom(0, "chat.list")`), иначе в
  логе они безымянные. Префикс — слайс-владелец (`chat.` — `entities/chat`, `chatPage.` —
  `pages/chat`), чтобы в логе различались одноимённые слайсы разных слоёв.
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
  клиент, иначе ничего не записывать. Исключение — фоновая работа на `withConnectHook`:
  отключение последнего подписчика отменяет её `abortVar`, в т.ч. запросы в полёте; проверка
  клиента после `await` там всё равно нужна (`401` → `logout()` внутри цикла). Патч-экшены по неизвестному ключу — no-op, ключ не
  создают.
- Экшен, вызываемый без `await` (`sendChatMessage`), не должен отклоняться (ни ошибкой, ни
  отменой): при сбросе кадра это был бы unhandled rejection. Исключение — синхронный `throw`
  без клиента (`requireApi()` из `entities/session`): ошибка программиста, экран чата требует креды. Долгую операцию, которую не
  должна отменять повторная отправка, делать обычным `action`, не `onSubmit` формы.
- Таймаут запроса — опция `timeout` клиента GREEN-API. Внутри `request()` —
  `setTimeout` + `AbortController` с причиной `TimeoutError`, не
  `AbortSignal.timeout()` (не подчиняется fake timers). Сигналы объединять вручную (общий
  `AbortController` + слушатель `abort`), не `AbortSignal.any()`: его нет в Safari < 17.4 и
  Chrome < 116, которые покрывает цель сборки Vite (полифилов нет). `isAbort` узнаёт только
  `AbortError`, поэтому таймаут — ошибка, а не отмена. `context.reset()` не отменяет ни
  запрос, ни этот таймер.
- Фоновый процесс — `withConnectHook` на отдельном атоме (`pollingAtom`; статус — простой
  атом, чтобы его чтение не запускало процесс): колбэк запускается при первом
  подписчике, в его кадре `wrap`/`sleep` и `abortVar.subscribe()` (`signal` запросов)
  отменяются при отключении; очистку (статус `idle`) возвращать из хука. Промис из хука
  никто не ждёт — ошибки кроме `isAbort` ловить и логировать. Внешние колбэки
  (`navigator.locks.request`) вызываются вне кадра — передавать `wrap(fn)`, сам промис
  `request` — тоже через `wrap()`; `await` своей async-функции — тоже через `wrap()`,
  иначе запись атома после него — `missing async stack`. Нет `navigator.locks` (jsdom) —
  работать без лока.
- `set()` persist-атома с `subscribe: false`, ещё не прочитанного в кадре, сравнивает с
  дефолтом: `set(null)` при дефолте `null` в хранилище не пишется. Сначала прочитать атом
  (так в `clearChats`).
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
  из URL (неожиданный метод роняет тест); `"hang"` — запрос висит до отмены (рендер `App`
  с кредами запускает опрос: `receiveNotification: "hang"`; `ChatPage` сам не опрашивает); массив — ответы по порядку,
  последний повторяется (`[{ body: notification }, "hang"]`). `calledMethods()` — список
  вызванных методов, `calledUrls()` — их URL.
  `deferFetch()` — каждый вызов ждёт `resolveNext(body, status?)`/`rejectNext(error)`
  (`resolveAt(index, body)` — ответ не по порядку), `pending()` — число ждущих, отмена — с `signal.reason` (состояние «до ответа», логаут
  посреди запроса).
- Web Locks: jsdom их не реализует. `stubWebLocks()` из `@test/web-locks` ставит
  эксклюзивный `navigator.locks` на время теста (снимается сам); `held(name)`/
  `waiting(name)` — состояние лока. Без стаба опрос идёт без лока. Подписки на
  `pollingAtom` в тестах снимать явно, иначе цикл утечёт (особенно с fake timers).
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
- Тест системной темы (`app.test.tsx`) подменяет `matchMedia` через `vi.stubGlobal` и в
  `afterEach` снимает `data-mantine-color-scheme` с `<html>` — `MantineProvider` оставляет
  атрибут на `documentElement` после размонтирования, иначе он утекает в следующий тест.
- `vitest.setup.ts`: `clearStack()`, очистка `localStorage`/`sessionStorage` после
  каждого теста, моки jsdom для Mantine, глобальный `DOMException` из Node (у jsdom он не
  `instanceof Error`, и `isAbort()` Reatom не узнавал бы отмену). DOM-API jsdom по-прежнему
  бросают свой `DOMException`: для них `instanceof DOMException`/`toThrow(DOMException)`
  ложны — проверять `error.name`.

## Правила

- Версии, CLI-флаги, конфиги и API библиотек сверять по актуальной документации, `--help`
  и npm, а не по памяти.
- Креды в `localStorage` — осознанное решение (раздел «Безопасность» дизайн-документа):
  без backend куки, память и шифрование от XSS не защищают. Менять хранение — только с
  обоснованием по модели угроз и обновлением этого раздела.
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
