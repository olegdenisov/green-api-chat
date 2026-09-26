# Этап 5: Получение сообщений

## Overview

- Пятый из 6 этапов (см. `docs/plans/20260923-telegram-chat-design.md`, «Этапы», «Потоки →
  Получение»).
- Пока пользователь залогинен, приложение опрашивает очередь уведомлений GREEN-API
  (`receiveNotification` с `receiveTimeout=20` → разбор → `deleteNotification`) и
  раскладывает сообщения по чатам. Ответ собеседника из Telegram появляется в чате; чата
  нет — он создаётся (не выбирается).
- Исходящие, отправленные с телефона (`outgoingMessageReceived`) и через API
  (`outgoingAPIMessageReceived`), тоже попадают в ленту, без дублей своих отправок.
- Опрашивает только одна вкладка — лидер (Web Locks); остальные получают данные через
  синхронизацию `localStorage`.
- Сбои: сеть/HTTP → backoff и индикатор «Соединение…» над экраном чата; `401`/`403` →
  логаут с тостом. Логаут останавливает цикл.
- Итог: сценарий задания «логин → чат → отправка → ответ из Telegram виден в чате»
  работает на реальном инстансе; `make check` зелёный после каждой задачи.

## Context (from discovery)

- Этапы 1–4 влиты в `main`; итоги — `docs/plans/completed/2026092*-0{1..4}-*.md`.
- `@/shared/api`: `receiveNotification({ receiveTimeout, signal })` → `ReceivedNotification
  | null` (`{ receiptId, body }`), `deleteNotification(receiptId, { signal })`; типы
  `Notification` (union без «ловушки»: `IncomingMessageNotification |
  OutgoingMessageNotification`), `MessageData` (`textMessage` | `extendedTextMessage`),
  `SenderData` (`chatType` optional). Неизвестные `typeWebhook`/`typeMessage` приходят в
  рантайме — ветка `default`. `request()` — единственное место с `fetch`.
- `entities/chat`: `chatsAtom`, `openChat` (создаёт **и выбирает** чат — для входящих не
  подходит), `touchChat(chatId, ts)` (только поднимает), `removeChat`, `clearChats`.
- `entities/message`: `messagesAtom`, `addMessage`, `updateMessage(chatId, id, patch)`
  (неизвестный id — no-op), `isSendingStale`. Удаления одного сообщения нет.
- `pages/chat/model/send-message.ts`: `deliver()` сам объединяет `abortVar` и таймаут
  `SEND_TIMEOUT` (`AbortController` + `TimeoutError`-таймер); после `await` проверяет
  `isCurrent()` — сообщение с тем же local-id и `attemptAt`. Если опрос уже присвоил
  сообщению `idMessage`, поздний ответ `sendMessage` — no-op (на этом строится дедупликация).
- `entities/session`: `greenApiAtom`, `logout`; очистка данных при логауте — хук в
  `src/app/user-data-cleanup.ts`.
- `src/app/app.tsx`: `Screen` выбирает `ChatPage`/`LoginPage` по `credentialsAtom`; логаут
  размонтирует экран чата. `ChatPage` — `sidebar | window`, на узком экране видна одна
  колонка (`data-view`), поэтому индикатор в шапке сайдбара мобильный пользователь в окне
  чата не увидит — индикатор ставится полосой в `ChatPage` над колонками.
- Reatom v1001 (skill `reatom`, «Lifecycle and extension hooks»): `withConnectHook` запускает
  колбэк при первом подписчике атома; `wrap`, `sleep` внутри отменяются при отключении;
  `abortVar.subscribe()` даёт `controller` для внешнего `signal`. Внешние колбэки
  (`navigator.locks.request`) вызываются вне кадра — только через `wrap(fn)`.
- steiger: слайс без `index.ts` роняет `fsd/public-api`, без потребителей или с одним (не
  `app`) — `fsd/insignificant-slice`; тесты тоже проверяются (`fsd/forbidden-imports`:
  `features` не импортирует `pages`). Поэтому каркас слайса с двумя потребителями (`app` и
  `pages/chat`) — первой задачей фичи.
- Тестовые хелперы: `@test/green-api` (`stubFetch`, `respondByMethod`, `deferFetch`,
  `hangUntilAbort`, `calledMethods`), `@test/render`. Фикстуры уведомлений:
  `incoming-text-message.ts`, `incoming-extended-text-message.ts`, `outgoing-message.ts`,
  `outgoing-api-message.ts`, `receive-notification.ts`, `delete-notification.ts`.
- jsdom не реализует `navigator.locks` — в тестах стаб, в коде — фолбэк без лока.

## Development Approach

- **testing approach**: Regular (код, затем тесты в той же задаче)
- каждую задачу завершать полностью до перехода к следующей; коммит на каждую задачу
- небольшие точечные изменения
- **CRITICAL: каждая задача включает новые/обновлённые тесты** — успешные и ошибочные сценарии
- **CRITICAL: `make check` зелёный до начала следующей задачи** (включая steiger)
- **CRITICAL: план обновляется при изменении объёма работ**
- сверять API Reatom по skill `reatom`/`reatom-async`, API GREEN-API — по
  https://green-api.com/telegram/docs/, не по памяти

## Testing Strategy

- **unit**: `request()` с таймаутом, сущности (`receiveChat`, `removeMessage`), парсер на
  фикстурах, раскладка с дедупликацией, защита `deliver()` от дубля id, цикл опроса с моком
  `fetch` и fake timers (включая переходы статуса), лидерство со стабом `navigator.locks`.
- **компонентные/интеграционные**: индикатор; `App` — запуск/остановка опроса при
  логине/логауте, входящее в списке чатов, `401` → экран логина, гонка «событие раньше ответа
  `sendMessage`» (живёт в `app.test.tsx`: `app` вправе импортировать и `pages`, и `features`).
- e2e-тестов в проекте нет.

## Progress Tracking

- отмечать выполненное `[x]` сразу
- новые задачи — с префиксом ➕, блокеры — с ⚠️
- при отклонении от плана — обновлять план

## Solution Overview

Слайс `features/receive-messages`:

```
features/receive-messages/
  index.ts                    ReceiveMessages, ConnectionIndicator
  model/
    receive-status.ts         receiveStatusAtom, setReceiveStatus; withConnectHook → лок → цикл
    parse-notification.ts     body → ReceivedMessage | null (чистая функция)
    apply-notification.ts     applyReceivedMessage: чат + дедупликация + addMessage/updateMessage
    poll.ts                   pollNotifications(): цикл receive → apply → delete, backoff
  ui/
    receive-messages.tsx      безголовый компонент: подписка на receiveStatusAtom
    connection-indicator.tsx  «Соединение…» при серии ошибок
```

- **Жизненный цикл — `withConnectHook` на `receiveStatusAtom`.** Подписчики — безголовый
  `ReceiveMessages` (рендерит `app` рядом с `ChatPage`, т.е. только при наличии кредов;
  время жизни опроса привязано к экрану с кредами, а не к индикатору) и `ConnectionIndicator`
  в `ChatPage`. Первый подписчик → хук: `navigator.locks.request("ga.polling", { signal },
  wrap(async () => pollNotifications()))`, сам промис `request` — через `wrap()`, отмена
  гасится по `isAbort`. Логаут → `Screen` показывает `LoginPage` → подписчиков нет →
  отключение → `abortVar` отменяет ожидание лока, `wrap`-ы и `sleep`; колбэк лока
  завершается (после выдачи лока `signal` у `request` уже не действует — колбэк выходит сам
  по отмене своих `wrap`/`sleep`), лок переходит к следующей вкладке.
- **Цикл выполняется в кадре хука**: отмена — из `abortVar`, статус — именованным экшеном
  `setReceiveStatus`, без колбэков. Клиент — `greenApiAtom()` **после** получения лока
  (ведомая вкладка может ждать долго).
- **Таймаут запроса — опция `timeout` в `shared/api`** (`RequestOptions`): объединение
  `signal` и таймера с `TimeoutError` в одном месте — `request()`. `deliver()` переходит на
  неё; цикл опроса использует её же.
- **Разбор отделён от эффектов**: `parseNotification` — чистая функция без Reatom, раскладка
  — экшен над сущностями, цикл — только I/O и тайминги.
- **Дедупликация** — см. «Раскладка»: по `idMessage`; `outgoingAPIMessageReceived`
  сопоставляется с ожидающей отправкой по тексту (сначала `sending`, потом `failed`);
  `deliver()` не создаёт второй такой же id.
- **Идемпотентность**: сбой `deleteNotification` вернёт то же событие; повторная раскладка
  ничего не меняет. Событие, на котором упала раскладка (не `ApiError`, не отмена), всё равно
  удаляется — иначе FIFO-очередь встанет.
- **Сущности не знают друг о друге**: связку чата и сообщения делает фича.

## Technical Details

### `request()` с таймаутом (`shared/api`)

- `RequestOptions = { signal?: AbortSignal; timeout?: number }` (мс), пробрасывается всеми
  методами.
- Внутри: общий `AbortController`; слушатель `abort` внешнего `signal` → `abort(signal.reason)`;
  `setTimeout` → `abort(new DOMException("…", "TimeoutError"))`; очистка таймера и слушателя
  в `finally`. Без `AbortSignal.any()`/`AbortSignal.timeout()` (Safari < 17.4, Chrome < 116;
  fake timers). Отмена по-прежнему пробрасывается причиной (`signal.reason`), не `ApiError`:
  таймаут — `TimeoutError` (не `isAbort`), внешняя отмена — `AbortError`.
- `deliver()`: `api.sendMessage(..., { signal, timeout: SEND_TIMEOUT })`; ручной код
  объединения удаляется, поведение и тесты этапа 4 не меняются.

### Разбор уведомления (`parseNotification(body: unknown)`)

```ts
type ReceivedMessage = {
  chatId: string;
  chatName?: string; // senderData.chatName, если непустая строка
  id: string; // idMessage
  text: string;
  direction: "in" | "out";
  viaApi: boolean; // true только у outgoingAPIMessageReceived
  timestamp: number; // ms = body.timestamp * 1000
};
```

- `incomingMessageReceived` → `in`; `outgoingMessageReceived` → `out`;
  `outgoingAPIMessageReceived` → `out`, `viaApi: true`.
- Текст: `textMessage` → `textMessageData.textMessage`; `extendedTextMessage` →
  `extendedTextMessageData.text`; прочие `typeMessage` (медиа) → `null`.
- Только личные чаты: `chatType` есть и не `"user"` → `null`; `chatId` не положительное
  целое строкой (группа — отрицательное) → `null`.
- Прочие `typeWebhook` (статусы, состояние инстанса) → `null`.
- Рантайм-валидации типов нет (решение этапа 2), но `body` из сети: отсутствующие поля
  (`senderData`, `messageData`, пустой `idMessage`, нечисловой `timestamp`) → `null`, без
  исключений.

### Раскладка (`applyReceivedMessage(message)`, экшен `receiveMessages.apply`)

1. `receiveChat({ chatId, title: chatName, timestamp })` — новое действие `entities/chat`:
   чата нет — создаётся (`title` — `chatName` или `chatId`, `lastMessageAt` — время
   сообщения), **не выбирается**; чат есть и `chatName` непустое и другое — обновляется
   `title` (решение дизайн-дока); `phone` не трогается.
2. Сообщение с `id` в `messagesAtom()[chatId]` уже есть → только `touchChat`, выход.
3. `viaApi`: ищется ожидающая отправка с тем же `text` — самое старое `out` со статусом
   `sending` (включая stale); нет — самое старое `out` `failed`. Найдено →
   `updateMessage(chatId, localId, { id, status: "sent" })`. Сопоставление только для
   API-событий: отправка с телефона с тем же текстом не «забирает» web-отправку. Приоритет
   `sending`: иначе событие новой отправки «ок» пометило бы отправленным старое `failed`
   «ок», реально не ушедшее.
4. Иначе `addMessage({ ..., status: "sent" })` (входящие — тоже `sent`, как в модели).
5. `touchChat(chatId, timestamp)`.

**Защита в `deliver()`** (`pages/chat`): после успешного `sendMessage`, если в чате уже есть
сообщение с `sentId` (событие этой отправки было сопоставлено с другим локальным сообщением
с тем же текстом), текущее локальное удаляется (`removeMessage` — новое действие
`entities/message`), а не получает второй такой же id. Итог при двух одинаковых текстах —
ровно два сообщения с разными id: второе событие не находит ожидающих и добавляется.

Порядок в ленте — порядок добавления (модель этапа 4); сообщения из очереди приходят по FIFO.

### Цикл (`pollNotifications()`)

- Выполняется в кадре connect-хука; `signal` — `abortVar.subscribe()` (`unsubscribe()` в
  `finally`), каждый `await` — через `wrap()`.
- Клиент — `greenApiAtom()` на входе; нет — выход. После каждого `await` сверять, что клиент
  тот же (логаут посреди запроса), иначе выход без записи.
- `receiveNotification({ receiveTimeout: RECEIVE_TIMEOUT_SECONDS, signal, timeout:
  RECEIVE_REQUEST_TIMEOUT })`.
- `null` → сразу следующий запрос.
- Событие → `parseNotification` → при `ReceivedMessage` — `applyReceivedMessage` (исключение
  — `console.error`, событие всё равно удаляется) → `deleteNotification(receiptId, { signal,
  timeout })` всегда (и для игнорируемых). Сбой `delete` — как сетевая ошибка (событие
  вернётся, раскладка идемпотентна).
- Ошибки запросов:
  - отмена (`isAbort`) → выход без изменений состояния;
  - `ApiError kind: "auth"` → тост «Сессия недействительна, войдите заново» + `logout()`,
    выход;
  - прочее (`network`, `http`, `TimeoutError`) → `failures++`, при `failures >=
    RECONNECTING_AFTER` — статус `reconnecting`; пауза `min(1000 * 2 ** (failures - 1),
    BACKOFF_MAX)` через `await wrap(sleep(ms))`; успешный ответ — `failures = 0`, статус
    `polling`.
- Константы: `RECEIVE_TIMEOUT_SECONDS = 20`, `RECEIVE_REQUEST_TIMEOUT = 30_000`,
  `BACKOFF_MAX = 30_000`, `RECONNECTING_AFTER = 2`; экспортируются только те, что нужны
  тестам (`RECEIVE_REQUEST_TIMEOUT`, `BACKOFF_MAX`).

### Статус (`receiveStatusAtom`, `receiveMessages.status`)

`"idle" | "follower" | "polling" | "reconnecting"`:

- `idle` — нет подписчиков; `follower` — ждёт лок (опрашивает другая вкладка); `polling` —
  лидер, запросы идут; `reconnecting` — лидер, `failures >= RECONNECTING_AFTER`.
- `setReceiveStatus` (`receiveMessages.setStatus`) — единственный писатель.
- `ConnectionIndicator` показывает «Соединение…» только в `reconnecting`. В ведомой вкладке
  индикатора нет (проблемы лидера она не видит — известное ограничение).
- Нет `navigator.locks` (jsdom, старые браузеры) → опрос без лока (каждая вкладка сама).

## What Goes Where

- **Implementation Steps** — код, тесты, документация в репозитории.
- **Post-Completion** — ручная проверка на реальном инстансе (CORS `receiveNotification`/
  `deleteNotification`, две вкладки, ответ из Telegram).

## Implementation Steps

### Task 1: Опция `timeout` в `shared/api`, `deliver()` на ней

**Files:**
- Modify: `src/shared/api/request.ts`, `src/shared/api/green-api.ts`
- Modify: `src/shared/api/request.test.ts`
- Modify: `src/pages/chat/model/send-message.ts`

- [x] `RequestOptions.timeout` (мс) и объединение сигналов в `request()` по «`request()` с
      таймаутом»; все методы клиента пробрасывают опцию
- [x] `deliver()` — `{ signal, timeout: SEND_TIMEOUT }`, ручное объединение удалить
- [x] тесты `request`: таймаут → `TimeoutError` (fake timers), не `ApiError`; внешняя отмена
      → `signal.reason`; ответ до таймаута — таймер снят (`vi.getTimerCount()`), слушатель
      снят; без `timeout` — как раньше
- [x] тесты `send-message.test.ts` этапа 4 — без изменений, зелёные
- [x] `make check` — зелёный

### Task 2: `receiveChat` и `removeMessage` в сущностях

**Files:**
- Modify: `src/entities/chat/model/chat.ts`, `src/entities/chat/index.ts`,
  `src/entities/chat/model/chat.test.ts`
- Modify: `src/entities/message/model/message.ts`, `src/entities/message/index.ts`,
  `src/entities/message/model/message.test.ts`

- [x] `receiveChat({ chatId, title?, timestamp })` (`chat.receive`): нет чата — создать без
      выбора (`title || chatId`, `lastMessageAt = timestamp`); есть — обновить `title`, если
      передан непустой и отличается; `activeChatIdAtom` и `phone` не трогать
- [x] `removeMessage(chatId, id)` (`message.remove`): неизвестный чат/id — no-op, ключ чата не
      создаётся
- [x] экспорт из `index.ts`; `receiveChat` пока без потребителя вне тестов — это экшен
      сущности, steiger проверяет слайсы, не экспорты
- [x] тесты `receiveChat`: создание без смены активного чата; обновление `title`;
      пустой/тот же `title` — без записи; `phone` сохраняется
- [x] тесты `removeMessage`: удаление; неизвестный id/чат — no-op, без записи
- [x] `make check` — зелёный

### Task 3: Каркас слайса `features/receive-messages` и подключение

**Files:**
- Create: `src/features/receive-messages/index.ts`
- Create: `src/features/receive-messages/model/receive-status.ts`
- Create: `src/features/receive-messages/ui/receive-messages.tsx`
- Create: `src/features/receive-messages/ui/connection-indicator.tsx`,
  `connection-indicator.module.css`, `connection-indicator.test.tsx`
- Modify: `src/app/app.tsx`, `src/app/app.test.tsx`
- Modify: `src/pages/chat/ui/chat-page.tsx`, `chat-page.module.css`, `chat-page.test.tsx`

- [x] `receiveStatusAtom` (`"idle"` по умолчанию) и `setReceiveStatus`; хука пока нет
- [x] `ReceiveMessages` — `reatomComponent`, читает `receiveStatusAtom()`, рендерит `null`;
      `Screen` в `app.tsx` рендерит его рядом с `ChatPage`
- [x] `ConnectionIndicator` — полоса «Соединение…» (Mantine `Loader` + текст,
      `role="status"`) только в `reconnecting`; в `ChatPage` над колонками (видна и на узком
      экране в обоих режимах)
- [x] тесты индикатора: скрыт в `idle`/`follower`/`polling`, виден в `reconnecting`
      (статус — через `frame.run(() => setReceiveStatus(...))`)
- [x] `make check` — зелёный, включая steiger (у слайса два потребителя)

### Task 4: Парсер уведомлений

**Files:**
- Create: `src/features/receive-messages/model/parse-notification.ts`
- Create: `src/features/receive-messages/model/parse-notification.test.ts`
- Create: `test/fixtures/green-api/ignored-notifications.ts` (статус сообщения, медиа, группа
  — по документации Telegram-версии)

- [x] тип `ReceivedMessage` и `parseNotification(body: unknown): ReceivedMessage | null` по
      «Разбор уведомления»; `switch` по `typeWebhook`/`typeMessage` с `default`
- [x] фикстуры игнорируемых событий (`satisfies` с типом, где он есть; для типов вне union —
      комментарий, почему без `satisfies`)
- [x] тесты на фикстурах: входящий `textMessage`, `extendedTextMessage`, исходящий с телефона
      (`viaApi: false`), исходящий API (`viaApi: true`); секунды → ms; `chatName` пустой →
      `undefined`
- [x] тесты игнора: статус, медиа, группа (`chatType`/отрицательный `chatId`), битое тело
      (нет `senderData`/`messageData`, пустой `idMessage`, `null`, не объект)
- [x] `make check` — зелёный

### Task 5: Раскладка с дедупликацией и защита `deliver()`

**Files:**
- Create: `src/features/receive-messages/model/apply-notification.ts`
- Create: `src/features/receive-messages/model/apply-notification.test.ts`
- Modify: `src/pages/chat/model/send-message.ts`, `send-message.test.ts`

- [x] `applyReceivedMessage` по шагам «Раскладка» (приоритет `sending` над `failed`,
      сопоставление только при `viaApi`)
- [x] `deliver()`: `sentId` уже есть в чате → `removeMessage(chatId, id)` вместо
      `updateMessage`
- [x] тесты раскладки: входящее в новый чат (создан, не выбран), в существующий (`title` →
      `chatName`, `lastMessageAt` поднят); повтор того же `idMessage` — без дубля
- [x] тесты сопоставления (атомы задаются напрямую, без `sendChatMessage` — `features` не
      импортирует `pages`): API-событие → local `sending` получает `idMessage`/`sent`;
      `failed` «ок» + `sending` «ок» → сопоставляется `sending`; нет `sending` → `failed`;
      два одинаковых `sending` — по порядку; с телефона (`viaApi: false`) при ожидающей
      отправке с тем же текстом — добавляется отдельно, ожидающая не тронута
- [x] тесты `deliver()` (`send-message.test.ts`): поздний ответ после сопоставления — no-op
      (одно сообщение); ответ с `idMessage`, который уже есть в чате у другого сообщения →
      текущее локальное удалено, дубля id нет
- [x] `make check` — зелёный

### Task 6: Цикл опроса

**Files:**
- Create: `src/features/receive-messages/model/poll.ts`
- Create: `src/features/receive-messages/model/poll.test.ts`

- [x] `pollNotifications()` по «Цикл»: кадр вызывающего, `abortVar`, `wrap`, `timeout`,
      backoff, сверка клиента, статус через `setReceiveStatus`
- [x] `401`/`403` → тост + `logout()`; отмена — тихий выход; исключение раскладки —
      `console.error` и удаление события
- [x] тесты (`respondByMethod`/`deferFetch`, fake timers; запуск в `context.start()` через
      экшен с отменой по `abortVar`): `null` → повтор; событие → раскладка →
      `deleteNotification` с тем же `receiptId`; игнорируемое — тоже удаляется; сбой `delete`
      → повтор того же события без дубля; «ядовитое» событие (раскладка бросает) удаляется,
      цикл идёт дальше
- [x] тесты ошибок и статуса: сеть → паузы 1 с, 2 с, 4 с… до 30 с; после
      `RECONNECTING_AFTER` сбоев — `reconnecting`, после успеха — `polling` и сброс паузы;
      таймаут запроса → как сетевая; `401` → логаут + тост (`vi.spyOn(notifications,
      "show")`); отмена посреди запроса и посреди паузы → запросов больше нет; логаут посреди
      запроса → ответ не раскладывается
- [x] `make check` — зелёный

### Task 7: Лидерство и запуск через `withConnectHook`

**Files:**
- Modify: `src/features/receive-messages/model/receive-status.ts`
- Create: `src/features/receive-messages/model/receive-status.test.ts`
- Create: `test/web-locks.ts` (стаб `navigator.locks`)

- [x] `withConnectHook` на `receiveStatusAtom`: `follower` → `wrap(navigator.locks.request(
      "ga.polling", { signal }, wrap(async () => { setReceiveStatus("polling"); await
      pollNotifications(); })))`, отмена ожидания гасится по `isAbort`; нет `navigator.locks`
      — `pollNotifications()` сразу; отключение → `idle`
      (статус `polling` ставит сам `pollNotifications()` — общий путь с фолбэком без лока;
      после ревью: хук — на `pollingAtom` в `model/polling.ts`, статус `receiveStatusAtom` —
      простой атом в `model/status.ts` без `setReceiveStatus`, цикл, закончившийся сам, → `idle`)
- [x] сверить `withConnectHook` + `abortVar` по skill `reatom-async` и пробой: StrictMode
      (connect → disconnect → connect) не запускает два цикла; лок освобождается при отмене
- [x] стаб `test/web-locks.ts`: `Object.defineProperty(navigator, "locks", { configurable:
      true, value })`, удаление в `onTestFinished`; очередь по имени; колбэк вызывается
      **асинхронно** (микротаском), как настоящий API; отмена по `signal` до выдачи лока
- [x] тесты: подписка запускает опрос; отписка останавливает (запросов нет, лок свободен);
      два кадра `context.start()` со стабом — опрашивает один, второй `follower`; отписка
      лидера — лок и опрос переходят ко второму; без `navigator.locks` — опрос идёт; в тестах
      явно отписываться, чтобы цикл не утёк при fake timers
- [x] `make check` — зелёный
- [x] ➕ `respondByMethod`: ответ `"hang"` (запрос висит до отмены) — рендер экрана чата теперь
      запускает опрос; `app.test.tsx`, `chat-page.test.tsx` — `receiveNotification: "hang"`
- [x] ➕ StrictMode-проба рендером: `ui/receive-messages.test.tsx`

### Task 8: Интеграционные тесты `App`

**Files:**
- Modify: `src/app/app.test.tsx`

- [x] после логина идёт `receiveNotification`; входящее появляется в списке чатов, чат не
      выбран
- [x] гонка: отправка → `outgoingAPIMessageReceived` раньше ответа `sendMessage` (`deferFetch`
      с `resolveAt`) → поздний ответ → в ленте одно сообщение, `sent`
- [x] логаут — запросы опроса прекращаются; `401` из опроса → экран логина и тост
- [x] `make check` — зелёный
- [x] ➕ `respondByMethod`: массив ответов — по порядку, последний повторяется
      (`[{ body: notification }, "hang"]`)

### Task 9: Verify acceptance criteria

- [x] входящее из Telegram появляется в чате; новый собеседник — новый чат (не выбран)
      (automated coverage: `app.test.tsx` «starts polling after login and lists an incoming
      chat without selecting it»; `apply-notification.test.ts` «creates the chat of a message
      from a new sender without selecting it»; manual check skipped - not automatable)
- [x] свои отправки не дублируются, в т.ч. при раннем `outgoingAPIMessageReceived` и
      одинаковых текстах (automated coverage: `app.test.tsx` «keeps one sent message when the
      API event outruns the sendMessage answer»; `apply-notification.test.ts` «matches two
      same-text sends in order», «a repeated API event after matching adds nothing»;
      `send-message.test.ts` «sendChatMessage after the polling matched the send»; manual check
      skipped - not automatable)
- [x] исходящие с телефона видны в ленте (automated coverage: ➕ `app.test.tsx` «shows a
      message sent from the phone in the open chat as outgoing»; `apply-notification.test.ts`
      «adds an outgoing phone message as sent»; manual check skipped - not automatable)
- [x] игнорируемые и «ядовитые» события удаляются из очереди (automated coverage:
      `poll.test.ts` «deletes an ignored notification without touching the data», «deletes a
      notification the layout throws on and goes on»; `parse-notification.test.ts` «ignores» /
      «returns null for a malformed body»)
- [x] сеть → backoff и индикатор; `401` → логаут с тостом; логаут останавливает опрос
      (automated coverage: `poll.test.ts` «backs off 1 s, 2 s, 4 s…», «logs out with a toast on
      401 and stops»; ➕ `app.test.tsx` «shows the connection strip after network errors and
      hides it on recovery», «logs out with a toast on 401 from polling», «stops polling on
      logout»; `connection-indicator.test.tsx`; manual offline check skipped - not automatable)
- [x] опрашивает одна вкладка (automated coverage: `receive-status.test.ts` «polls in one tab
      only, the other waits as a follower», «hands the lock and the polling over…»; manual
      two-tab check skipped - not automatable)
- [x] `make check` — зелёный

### Task 10: [Final] Update documentation

- [x] дизайн-док: «Потоки → Получение» и «Этапы» (итог этапа 5), `features/receive-messages`
      в схеме FSD, решения (сопоставление API-событий по тексту с приоритетом `sending`,
      защита `deliver()`, `receiveChat`, `timeout` в `shared/api`, фолбэк без Web Locks,
      индикатор только у лидера)
- [x] «Известные ограничения»: индикатор только у лидера; постоянная `http`-ошибка (например,
      `400` при `webhookUrl`, выставленном извне после логина) выглядит как вечное
      «Соединение…»; сопоставление по точному тексту (если сервер нормализует текст — дубль);
      запись лидера может затереть одновременную отправку в другой вкладке (вернётся через
      API-событие); события очереди за 24 ч воссоздают удалённый чат и появляются при первом
      входе
- [x] `AGENTS.md`: фоновая работа через `withConnectHook` + `wrap` для внешних колбэков
      (`navigator.locks`), опция `timeout` в `shared/api` вместо ручного объединения
      сигналов, стаб `@test/web-locks`
- [x] переместить план в `docs/plans/completed/` (skipped - план перемещает harness после всех этапов)

## Post-Completion

*Требует ручных действий или внешних систем*

**Ручная проверка на реальном инстансе:**
- CORS для `receiveNotification`/`deleteNotification` из браузера (не проверено на этапе 4);
  если блокируется — варианты из дизайн-дока (Vite `server.proxy`, прокси для прода) —
  отдельной задачей
- ответ из Telegram появляется в чате; сообщение с телефона — в ленте как исходящее
- новый собеседник пишет первым — чат создаётся
- многострочное сообщение и сообщение с пробелами по краям — без дубля (сервер не
  нормализует текст)
- две вкладки: опрашивает одна (DevTools → Network), закрытие лидера — опрос переходит;
  отправка из ведомой при входящем потоке — без потерь/дублей
- отключение сети (DevTools offline) → «Соединение…», восстановление — индикатор пропадает
