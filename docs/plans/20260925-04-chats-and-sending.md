# Этап 4: Чаты и отправка

## Overview

- Четвёртый из 6 этапов (см. `docs/plans/20260923-telegram-chat-design.md`, «Этапы»).
- Пользователь на экране чата вводит номер телефона → `checkAccount` → чат появляется в
  списке и открывается; пишет сообщение → оно сразу видно в ленте (`sending`), затем
  `sent` или `failed` с кнопкой «Повторить». Чат можно удалить вместе с историей.
- Чаты, выбранный чат и сообщения хранятся в `localStorage` (истории у GREEN-API нет).
  Логаут (любой путь — кнопка сейчас, `401` из polling на этапе 5) стирает их.
- Вёрстка — базовая, по мотивам web.max.ru: сайдбар со списком + окно чата; на узком
  экране — либо список, либо окно (кнопка «назад»). Пустые состояния — сразу.
- Вкладки синхронизируются: новый чат, отправленные сообщения и логаут видны во всех
  открытых вкладках; выбранный чат и черновик у каждой вкладки свои.
- Итог: сценарий «логин → чат по номеру → отправка» работает на реальном инстансе;
  получение ответов — этап 5; `make check` зелёный.

## Context (from discovery)

- Этапы 1–3 влиты в `main`; итоги — `docs/plans/completed/2026092*-0{1,2,3}-*.md`.
- `@/shared/api`: `createGreenApi(creds)` — `checkAccount(phoneNumber: number)` (→
  `CheckAccountResult` `{ exist, chatId, username? }` или `CheckAccountFailure`;
  `rate_limit_exceeded` → `ApiError { kind: "rate-limit" }`), `sendMessage({ chatId,
  message })` → `{ idMessage }`; все методы с `{ signal }`. `ApiError.kind`: `auth` /
  `network` / `rate-limit` / `http` (`status`).
- `entities/session`: `credentialsAtom` (persist `ga.credentials`, `fromSnapshot`, своя
  константа `CREDENTIALS_TTL`), `logout` (только `credentialsAtom.set(null)`).
- `features/auth`: `LoginForm`, `LogoutButton`; модель `loginForm` — образец `reatomForm`
  (`resetOnSubmit`, `abortVar.subscribe()`, `wrap`, `withChangeHook` на полях на уровне
  модуля).
- `pages/chat` — заглушка: шапка (`AppTitle`, `LogoutButton`) + текст. `app/app.tsx`
  выбирает экран по `credentialsAtom`.
- steiger `fsd/insignificant-slice` (сверено по коду плагина): ругается на слайс с 0
  ссылок или с 1 ссылкой **из другого слайса**; одна ссылка только из `app` — допустима;
  слайсы `pages` правило не проверяет. Поэтому раскладка дизайн-дока (`widgets/chat-list`,
  `widgets/chat-window`, `features/create-chat`, `features/send-message` — у каждого по
  одному потребителю) steiger не пройдёт.
- Reatom (сверено по `dist` и пробами на ревью плана):
  - `withChangeHook((state, prevState) => …)`; `extend` мутирует атом на месте. Хук
    выполняется в кадре, где изменился атом, но **не синхронно**: в фазе хуков. Сразу после
    `logout()` данные ещё старые, после `notify()` (или микротаска) — очищены. Хук
    срабатывает и на логаут из другой вкладки (`storage`-событие синхронизирует креды).
  - `withLocalStorage` по умолчанию подписан на хранилище (`withProactivePersist`):
    `fromSnapshot` вызывается **и после собственных записей** атома, не только при старте.
    Поэтому `fromSnapshot` должен быть чистой проверкой формы, без преобразований данных.
    С `subscribe: false` — путь `withInit`, `fromSnapshot` только при инициализации.
  - `reatomComponent` по умолчанию не отменяет работу при размонтировании
    (`abortOnUnmount: false`); `logout` кадр провайдера не сбрасывает. Незавершённые
    запросы после логаута доходят до конца — их результат нужно отбрасывать явно.
  - `reatomForm` с `resetOnSubmit` сбрасывает поля только после успешного `onSubmit`;
    `form.reset()` внутри `onSubmit` отменил бы текущий сабмит.
- Тестовые хелперы: `@test/render` (`frame.run`), `@test/green-api` (`stubFetch`,
  `respondJson`, `respondByMethod` — один ответ на метод, сразу; `calledMethods`,
  `hangUntilAbort`, `creds`). Фикстуры `check-account.ts` (есть: exists, not-exists,
  лимит `200`, инстанс не готов, тело `469`) и `send-message.ts` — новых файлов не нужно.

## Development Approach

- **testing approach**: Regular (код, затем тесты в той же задаче)
- каждую задачу завершать полностью до перехода к следующей; коммит на каждую задачу
- **CRITICAL: каждая задача с кодом включает новые/обновлённые тесты**
- **CRITICAL: каждая задача заканчивается зелёным `make check`**
- **CRITICAL: обновлять этот план при изменении скоупа**
- API Reatom (`withLocalStorage`, `computed`, `action`, `withChangeHook`, `reatomForm`,
  `reatomField`, `bindField`, `abortVar`) сверять по skill `reatom`/`reatom-async` и
  `.d.ts` в `node_modules`, не по памяти. Расхождения с планом — ⚠️ в плане.
- Без роутера и новых зависимостей (в т.ч. без `@mantine/modals`, иконочных пакетов).
- YAGNI: не делать polling/получение (этап 5), черновики по чатам, поиск по чатам,
  логаут по `401` из `create-chat`/`send-message`, выбор вкладки-лидера для polling
  (этап 5).

## Testing Strategy

- **unit tests (модели)**: без рендера, внутри `context.start(() => ...)`; `fetch` — через
  `@test/green-api`. После `field.change(...)` и после действий, от которых срабатывают
  change-хуки (`logout`, смена активного чата), — `notify()` перед проверками. Тосты —
  `vi.spyOn(notifications, "show")`.
- **управляемые ответы**: ➕ хелпер `deferFetch()` в `test/green-api.ts` (Task 7) — каждый
  вызов `fetch` ждёт, пока тест не разрешит его (`resolveNext(body)` / `rejectNext(error)`),
  с отменой по `signal`, как `hangUntilAbort`. Нужен для «`sending` до ответа», двух
  отправок с разными `idMessage` и «логаут посреди запроса».
- **persist**: круговой путь через новый кадр `context.start()`; формат `PersistRecord` не
  проверять. Битые снапшоты через `localStorage` не подать, не завязавшись на внутренний
  формат записи, поэтому `fromSnapshot`-функции экспортируются из файла модели (не из
  `index.ts`) и тестируются напрямую.
- **component tests**: `render` из `@test/render`, `userEvent.setup()`, тосты по тексту,
  `afterEach(() => notifications.clean())`.
- **e2e**: нет. Проверка на реальном инстансе — в Post-Completion.

## Progress Tracking

- отмечать выполненное `[x]` сразу
- новые задачи — с префиксом ➕
- проблемы/блокеры — с префиксом ⚠️
- при отклонении от плана — обновлять план

## Solution Overview

### Раскладка (FSD, pages-first)

```
src/
  app/
    app.tsx                 + import "./user-data-cleanup"
    user-data-cleanup.ts    credentialsAtom → null ⇒ deleteAllChats()
  pages/chat/
    model/
      create-chat.ts        createChatForm (номер → checkAccount → чат)
      create-chat-error.ts  тексты ошибок create-chat
      send-message.ts       sendChatMessage / retryChatMessage / draftField + sendDraft
      active-chat.ts        activeMessagesAtom
    ui/
      chat-page.tsx         раскладка: Sidebar + ChatWindow, мобильный режим
      sidebar.tsx           шапка (AppTitle, LogoutButton), CreateChatForm, ChatList
      create-chat-form.tsx
      chat-list.tsx         список / пустое состояние
      chat-window.tsx       шапка (назад, название, DeleteChatButton), лента, Composer
      message-bubble.tsx    текст, время, статус, «Повторить»
      composer.tsx          Textarea, Enter / Shift+Enter, 4096
  features/delete-chats/    deleteChat(chatId), deleteAllChats(), DeleteChatButton
  entities/
    session/                + greenApiAtom
    chat/                   Chat, chatsAtom, activeChatIdAtom, сортировка, экшены
    message/                Message, messagesAtom, экшены
  shared/config/
    persist.ts              PERSIST_TTL (10 лет) — для session, chat, message
```

- **pages-first** вместо `widgets/*` и `features/create-chat|send-message`: у них один
  потребитель, `fsd/insignificant-slice` велит слить их в страницу. Это подход FSD 2.1 —
  код живёт в странице, пока не переиспользуется. Исключений steiger не добавляем.
- **Сущности не знают друг о друге.** Каждая даёт атомарные экшены (`removeChat`,
  `clearChats`, `removeChatMessages`, `clearMessages`). Связку делает фича
  `features/delete-chats`: `deleteChat(chatId)` — чат + его сообщения, `deleteAllChats()` —
  всё. Потребители фичи: `pages/chat` (`DeleteChatButton`) и `app` (очистка при логауте) —
  две ссылки, steiger доволен.
- **Очистка при логауте — реакция в `app`.** `src/app/user-data-cleanup.ts` на уровне
  модуля: `credentialsAtom.extend(withChangeHook((state, prev) => { if (state === null &&
  prev) deleteAllChats() }))`. Хук выполняется в кадре, где изменились креды (в фазе
  хуков, не синхронно внутри `logout`); модуль создаёт не атомы, а только расширение,
  поэтому порядок импорта относительно логгера не важен. Любой логаут (`session.logout`,
  в т.ч. из другой вкладки) чистит данные автоматически — на этапе 5 `receive-messages`
  просто вызовет `logout`.
- **Поздние ответы после логаута отбрасываются.** Логаут не сбрасывает кадр и не отменяет
  запросы в полёте. Поэтому:
  - `createChatForm.onSubmit` после `await checkAccount` сверяет, что `greenApiAtom()` —
    всё тот же клиент, с которым запрос начинался; иначе выходит, ничего не записав;
  - `sendChatMessage` после `await` так же сверяет клиент и при расхождении ничего не
    пишет; вдобавок `updateMessage` никогда не создаёт ключ чата (патч по неизвестному
    чату/id — no-op), так что удалённая история не воскресает.
- **`greenApiAtom`** — `computed` в `entities/session`: клиент из кредов или `null`. Модели
  страницы берут клиент из него (на экране чата креды всегда есть; `null` — ошибка
  программиста, `throw`).
- **`PERSIST_TTL`** — `src/shared/config/persist.ts` (третье использование: session, chat,
  message); `CREDENTIALS_TTL` в `entities/session` заменяется им. `shared/lib` под persist
  по-прежнему не заводим.

### Ключевые решения

- **Существующий чат по номеру открывается без `checkAccount`**: в `Chat` хранится
  `phone` (нормализованный номер). Экономит лимит Telegram (частые проверки → временные
  ограничения). Если номера нет в чатах, но `checkAccount` вернул `chatId`, который уже
  есть (чат пришёл входящим на этапе 5), — открывается существующий, `phone` дописывается.
- **Отправка не отменяется сменой чата, новой отправкой и размонтированием окна** (на
  мобильном «←» размонтирует `ChatWindow`). Поэтому `sendChatMessage` — обычный `action`,
  вызываемый из обработчика, не `onSubmit` формы (повторный сабмит отменил бы предыдущую
  отправку). Отменить её может только сброс кадра (`context.reset()` в тестах,
  перезагрузка страницы); логаут — нет, см. «Поздние ответы».
- **Поле ввода** — `reatomField` (не форма) + `bindField` на Mantine `Textarea`;
  `sendDraft` читает текст, проверяет, сбрасывает поле и вызывает `sendChatMessage` без
  `await`. Черновик общий; при смене активного чата (в т.ч. «←» на мобильном)
  сбрасывается — так задумано.
- **Синхронизация вкладок** — встроенная подписка `withLocalStorage` (`subscribe: true`
  по умолчанию, событие `storage`):

  | атом | синхронизация | почему |
  | --- | --- | --- |
  | `credentialsAtom` | да (как сейчас) | логаут в одной вкладке — во всех (и очистка данных через хук) |
  | `chatsAtom`, `messagesAtom` | да | новый чат и сообщения видны везде |
  | `activeChatIdAtom` | нет (`subscribe: false`) | выбор чата у вкладки свой; иначе выбор в B переключал бы A и стирал её черновик |

  `withBroadcastChannel` из `@reatom/core` не нужен — `localStorage` даёт и хранение, и
  синхронизацию. Записи — целиком атом: одновременные записи двух вкладок в одном тике
  теряют одну из них; от действий пользователя это практически не случается, для polling
  этапа 5 — лидер через Web Locks (см. Task 11).
- **`fromSnapshot` — только проверка формы, без преобразований.** При подписке он
  вызывается и после собственных записей атома (сверено на ревью плана), поэтому
  превращение `sending` → `failed` в нём ломало бы отправки в полёте.
- **Прерванная отправка определяется по таймауту, без записи.** `sendChatMessage`
  ограничен `SEND_TIMEOUT` (30 с, `AbortSignal.timeout`) — без ответа сообщение само
  становится `failed`. В `Message` есть `attemptAt` (начало последней попытки);
  `isSendingStale(message, now)` — `status === "sending" && now - attemptAt >
  SEND_TIMEOUT` — такое сообщение показывается как `failed` («Повторить» доступен). Так
  ловятся отправки из закрытой вкладки и прерванные перезагрузкой. Пометка при старте не
  годится: вкладка B пометила бы `failed` живую отправку вкладки A → «Повторить» → дубль.
- **Удаление чата** — кнопка в шапке окна чата, подтверждение через Mantine `Popover`
  («Удалить чат и историю?» → «Удалить»).

## Technical Details

### Модель данных

```ts
// entities/chat
type Chat = {
  chatId: string
  title: string          // username из checkAccount или "+<phone>"; этап 5 обновит на chatName
  phone?: string         // только цифры; нет у чатов, созданных входящим (этап 5)
  lastMessageAt: number  // ms; для нового чата — время создания
}
// entities/message
type Message = {
  id: string             // idMessage или `local-${crypto.randomUUID()}`
  chatId: string
  text: string
  direction: "in" | "out"
  status: "sending" | "sent" | "failed"
  timestamp: number      // ms (этап 5 переводит секунды GREEN-API в ms)
  attemptAt?: number     // ms, начало последней попытки отправки; только у исходящих
}
```

### Атомы и экшены

| слайс | атом / экшен | назначение |
| --- | --- | --- |
| `entities/session` | `greenApiAtom` (`session.greenApi`) | `computed`: `createGreenApi(creds)` или `null` |
| `entities/chat` | `chatsAtom` (`chat.list`, persist `ga.chats`) | `Record<chatId, Chat>` |
| | `activeChatIdAtom` (`chat.activeId`, persist `ga.activeChatId`) | `string \| null` |
| | `sortedChatsAtom` (`chat.sorted`) | `computed`: по `lastMessageAt` убыв. |
| | `activeChatAtom` (`chat.active`) | `computed`: чат по `activeChatIdAtom` или `null` (висячий id → `null`) |
| | `openChat(chat)` | добавить, если нет (иначе дописать `phone`), и выбрать |
| | `touchChat(chatId, timestamp)` | поднять `lastMessageAt` (не опускать); нет чата — no-op |
| | `findChatByPhone(phone)` | обычная функция, читает `chatsAtom()` в вызывающем экшене |
| | `removeChat(chatId)` | удалить; если активный — `activeChatIdAtom.set(null)` |
| | `clearChats()` | `{}` и `null` |
| `entities/message` | `messagesAtom` (`message.byChat`, persist `ga.messages`) | `Record<chatId, Message[]>`, по порядку добавления |
| | `addMessage(message)` | в конец списка чата |
| | `updateMessage(chatId, id, patch)` | патч по id (в т.ч. смена `id` на `idMessage`); нет чата/id — no-op, ключ не создаётся |
| | `removeChatMessages(chatId)`, `clearMessages()` | удаление |
| | `isSendingStale(message, now)`, `SEND_TIMEOUT` | зависшая отправка → показывать как `failed` |
| `features/delete-chats` | `deleteChat(chatId)`, `deleteAllChats()` | связка сущностей |
| `pages/chat` | `activeMessagesAtom` | `computed`: сообщения активного чата или `[]` |
| | `createChatForm` | `reatomForm({ phone })` |
| | `sendChatMessage(chatId, text)`, `retryChatMessage(chatId, id)` | отправка |
| | `draftField`, `sendDraft()` | поле ввода |

Persist — `withLocalStorage({ key, time: PERSIST_TTL, fromSnapshot })`; у
`activeChatIdAtom` ещё `subscribe: false`. `fromSnapshot` — чистая проверка формы: не
объект / элемент не той формы → отбросить элемент (не весь снапшот); `activeChatId` — не
строка → `null`; корректные данные возвращаются без изменений.

### Создание чата

1. Валидация поля: `normalizePhone(value)` — убрать всё, кроме цифр (пробелы, `+`, `-`,
   скобки); пусто → «Введите номер телефона»; не 10–15 цифр → «Номер — от 10 до 15 цифр
   в международном формате». Ведущую `8` не переписываем; плейсхолдер `+7 999 123-45-67`.
2. `findChatByPhone(phone)` → есть: `openChat`, без запроса.
3. `checkAccount(Number(phone), { signal })` через клиент из `greenApiAtom()`; после
   `await` — проверка «клиент не сменился» (иначе выход без записи):
   - `{ exist: true, chatId, username }` → `openChat({ chatId, title: username ?? "+" +
     phone, phone, lastMessageAt: Date.now() })`;
   - `{ exist: false }` → ошибка «Номер не зарегистрирован в Telegram»;
   - `CheckAccountFailure` → «Инстанс не готов, попробуйте позже».
4. Сброс поля — `resetOnSubmit: true` (как `loginForm`): только при успехе (путь 2 и
   `exist: true`); при ошибке номер остаётся для правки. `form.reset()` внутри `onSubmit` не
   вызывать — отменит сабмит.
5. Тексты ошибок (`create-chat-error.ts`, по образцу `login-error.ts`):

| причина | текст |
| --- | --- |
| нет аккаунта | Номер не зарегистрирован в Telegram |
| `rate-limit` | Слишком много проверок номеров. Попробуйте позже |
| `CheckAccountFailure` | Инстанс не готов, попробуйте позже |
| `http` `400` | Неверный формат номера |
| `http` `466` | Исчерпан лимит тарифа GREEN-API |
| `auth` | Доступ запрещён. Выйдите и войдите заново |
| `network` | Нет соединения с GREEN-API |
| прочее | Не удалось проверить номер |

Ошибка — под полем (`submit.error()`, провал валидации отличается по тождеству, как в
`LoginForm`); исчезает при правке поля. Повторный сабмит отменяет предыдущий.

### Отправка

1. `sendDraft()`: `text = draftField().trim()`; пусто или нет активного чата → ничего;
   `draftField.reset()`; `sendChatMessage(chatId, text)` без `await`.
2. `sendChatMessage(chatId, text)`: `id = local-<uuid>`; `addMessage({ status: "sending",
   direction: "out", timestamp: now, attemptAt: now })`; `touchChat`; `api.sendMessage({
   chatId, message: text }, { signal })` с `signal = AbortSignal.any([controller.signal,
   AbortSignal.timeout(SEND_TIMEOUT)])` (`controller` из `abortVar.subscribe()`,
   `unsubscribe()` в `finally`), `await wrap(...)`. Таймаут — это ошибка (`failed`), а не
   отмена: отличать по `signal.reason?.name === "TimeoutError"` до проверки `isAbort`
   (⚠️ сверить, как `request()` пробрасывает `signal.reason` таймаута). После ответа — проверка «клиент не сменился», затем
   `updateMessage(id, { id: idMessage, status: "sent" })`; ошибка → `{ status: "failed" }`.
   Отмена (`isAbort`) — сообщение не трогаем. **Экшен ничего не пробрасывает** (ни
   ошибку, ни отмену): его вызывают без `await`, и отклонённый промис при сбросе кадра
   стал бы unhandled rejection.
3. `retryChatMessage(chatId, id)`: для `failed` и зависших (`isSendingStale`); `status:
   "sending"`, новый `attemptAt`, тот же текст и временный id, тот же путь.
4. Клиент: `Textarea` `autosize`, `maxLength={4096}`; `Enter` → `sendDraft`, `Shift+Enter` —
   перенос (не перехватывать); кнопка «Отправить» неактивна при пустом `trim()`;
   IME-композиция (`event.nativeEvent.isComposing`) — `Enter` не отправляет.

### UI

- Раскладка `pages/chat`: грид `sidebar (320px) | window`. `@media (max-width:
  $mantine-breakpoint-sm)`: показывается одна колонка — `data-view="list" | "chat"` на
  корне по `activeChatAtom`; в шапке окна кнопка «←» → `activeChatIdAtom.set(null)`
  (видна только на узком экране).
- Сайдбар: шапка (`AppTitle`, `LogoutButton`), форма нового чата, список (`NavLink`-подобные
  строки: название, последнее сообщение, время). Пусто → «Создайте чат по номеру
  телефона».
- Окно: нет активного чата → «Выберите чат или создайте новый»; иначе шапка, лента
  (пузыри справа/слева по `direction`, время `HH:MM`, статус: «…» / «✓» / «Не отправлено ·
  Повторить»), пустая лента → «Сообщений пока нет», автоскролл вниз при новом сообщении.
- Иконки — символы/inline SVG, без новых пакетов.

### Временные исключения steiger

`fsd/insignificant-slice: "off"` в `steiger.config.ts` (с комментарием-причиной, как на
этапе 3) для новых слайсов, пока у них меньше двух потребителей; снимаются, как только
потребителей хватает:

| слайс | добавить | снять | потребители |
| --- | --- | --- | --- |
| `entities/chat` | Task 2 | Task 6 | `features/delete-chats`, `pages/chat` |
| `entities/message` | Task 3 | Task 7 | `features/delete-chats`, `pages/chat` |
| `features/delete-chats` | Task 4 | Task 5 | `app` (одной ссылки из `app` достаточно) |

## What Goes Where

- **Implementation Steps** (`[ ]`): код, тесты, документация в этом репозитории.
- **Post-Completion** (без чекбоксов): проверка на реальном инстансе и телефоне.

## Implementation Steps

### Task 1: `greenApiAtom` и `PERSIST_TTL`

**Files:**
- Create: `src/shared/config/persist.ts`
- Create: `src/shared/config/index.ts`
- Modify: `src/entities/session/model/session.ts`
- Modify: `src/entities/session/index.ts`
- Modify: `src/entities/session/model/session.test.ts`

- [x] `PERSIST_TTL` в `shared/config` (комментарий про `Infinity` → `null` переносится
      туда); `credentialsAtom` использует его вместо `CREDENTIALS_TTL`
- [x] `greenApiAtom = computed(() => …, "session.greenApi")`: `createGreenApi(creds)` или
      `null`; экспорт из `index.ts`
- [x] тесты: `null` без кредов; клиент с кредами — вызов метода идёт на URL с `idInstance`
      (через `stubFetch`); после `logout` — `null`; новые креды → новый экземпляр
- [x] существующий тест persist кредов проходит без изменений
- [x] `make check` — зелёный (`shared/config` — сегмент без слайсов, steiger правило
      `insignificant-slice` к нему не применяет)

### Task 2: `entities/chat`

**Files:**
- Create: `src/entities/chat/index.ts`
- Create: `src/entities/chat/model/chat.ts`
- Create: `src/entities/chat/model/chat.test.ts`
- Modify: `steiger.config.ts`

- [x] тип `Chat`; `chatsAtom`, `activeChatIdAtom` с `withLocalStorage` (`ga.chats`,
      `ga.activeChatId`, `PERSIST_TTL`, `subscribe: false` только у `activeChatIdAtom`,
      `fromSnapshot` — поэлементная проверка формы, экспорт из файла модели для тестов)
- [x] `sortedChatsAtom`, `activeChatAtom`; экшены `openChat`, `touchChat`, `removeChat`,
      `clearChats`; функция `findChatByPhone`
      (➕ `toChats` проверяет и `chatId` элемента = ключ записи; валидный снапшот
      возвращается тем же объектом; `openChat` обновляет `phone`, если он передан и
      отличается)
- [x] временный override `fsd/insignificant-slice` для `./src/entities/chat/**` (см.
      таблицу исключений)
- [x] тесты: `openChat` добавляет и выбирает / существующий не перезаписывается, но
      получает `phone`; `touchChat` не опускает время и no-op для неизвестного чата;
      сортировка; `activeChatAtom` при висячем id; `removeChat` активного сбрасывает
      выбор, неактивного — нет; `clearChats`; `findChatByPhone`
- [x] тесты persist: круговой путь в новом кадре; `fromSnapshot` отбрасывает битые
      элементы и нестроковый `activeChatId`
- [x] тесты синхронизации (запись во втором кадре `context.start()` + `StorageEvent` с
      ключом, ⚠️ способ сверить по реализации подписки): `chatsAtom` подхватывает чужую
      запись, `activeChatIdAtom` — нет
      (⚠️ сверено: `reatomPersistWebStorage.subscribe` слушает `storage` по ключу, кэш
      `storageAtom` — свой у каждого кадра; с `subscribe: false` подписки нет вовсе —
      тест фиксирует это поведение)
- [x] `make check` — зелёный

### Task 3: `entities/message`

**Files:**
- Create: `src/entities/message/index.ts`
- Create: `src/entities/message/model/message.ts`
- Create: `src/entities/message/model/message.test.ts`
- Modify: `steiger.config.ts`

- [x] тип `Message` (с `attemptAt`); `messagesAtom` с `withLocalStorage` (`ga.messages`,
      `PERSIST_TTL`, `fromSnapshot` — поэлементная проверка формы без преобразований)
- [x] `SEND_TIMEOUT` (30 с), `isSendingStale(message, now)`
- [x] экшены `addMessage`, `updateMessage` (no-op без чата/id, ключ не создаёт),
      `removeChatMessages`, `clearMessages`
      (➕ `toMessages` проверяет и `chatId` сообщения = ключ записи, не-массив по ключу
      отбрасывается; валидный снапшот возвращается тем же объектом; `isSendingStale` без
      `attemptAt` считает от `timestamp`; `MessagePatch` = `Partial<Omit<Message, "chatId">>`)
- [x] добавить `./src/entities/message/**` во временный override
- [x] тесты: добавление в конец; `updateMessage` по id (смена id; неизвестный id и
      неизвестный чат — без изменений и без нового ключа); удаление чата не трогает
      другие; `clearMessages`
- [x] тесты persist: круговой путь (`sending` сохраняется как есть); битые элементы
      отброшены; **два `addMessage` со `sending` подряд — оба остаются `sending`**
- [x] тест синхронизации: `messagesAtom` подхватывает запись другой вкладки
- [x] тесты `isSendingStale`: свежее `sending` — нет; старше `SEND_TIMEOUT` — да; `sent`/
      `failed` и входящие — нет
- [x] `make check` — зелёный

### Task 4: `features/delete-chats`

**Files:**
- Create: `src/features/delete-chats/index.ts`
- Create: `src/features/delete-chats/model/delete-chats.ts`
- Create: `src/features/delete-chats/model/delete-chats.test.ts`
- Create: `src/features/delete-chats/ui/delete-chat-button.tsx`
- Create: `src/features/delete-chats/ui/delete-chat-button.test.tsx`
- Modify: `steiger.config.ts`

- [x] `deleteChat(chatId)` (`removeChat` + `removeChatMessages`), `deleteAllChats()`
      (`clearChats` + `clearMessages`), имена `deleteChats.*`
- [x] `DeleteChatButton({ chatId })`: `Popover` с подтверждением «Удалить чат и историю?»
      → «Удалить» / «Отмена»
      (➕ кнопка-триггер подписана «Удалить чат» — отличается от «Удалить» в подтверждении;
      обычный компонент с `useState` + `useWrap`)
- [x] публичный API: `DeleteChatButton`, `deleteAllChats`; `./src/features/delete-chats/**`
      — во временный override
- [x] тесты модели: `deleteChat` удаляет чат и только его сообщения, сбрасывает выбор;
      `deleteAllChats` чистит всё
- [x] тесты компонента: «Отмена» не удаляет, «Удалить» удаляет
- [x] `make check` — зелёный

### Task 5: очистка данных при логауте в `app`

**Files:**
- Create: `src/app/user-data-cleanup.ts`
- Create: `src/app/user-data-cleanup.test.ts`
- Modify: `src/app/app.tsx`
- Modify: `steiger.config.ts`

- [x] `credentialsAtom.extend(withChangeHook((state, prev) => …))` → `deleteAllChats()`
      при переходе «креды → `null`»; комментарий-причина (сущности не знают друг о друге,
      любой логаут, в т.ч. из другой вкладки, чистит данные; хук — в фазе хуков)
- [x] side-effect импорт `./user-data-cleanup` в `app.tsx`
- [x] снять override для `features/delete-chats` (ссылка из `app`)
- [x] тесты (после `logout()` — `notify()`, затем проверки): чистит чаты, сообщения и
      выбор; установка кредов (логин) ничего не удаляет; `logout` при `null` — без
      ошибок; в новом кадре `context.start()` данные не возвращаются
- [x] `make check` — зелёный

### Task 6: модель создания чата (`pages/chat`)

**Files:**
- Create: `src/pages/chat/model/create-chat.ts`
- Create: `src/pages/chat/model/create-chat.test.ts`
- Create: `src/pages/chat/model/create-chat-error.ts`
- Create: `src/pages/chat/model/create-chat-error.test.ts`
- Modify: `src/pages/chat/ui/chat-page.tsx` (временно: список названий из
  `sortedChatsAtom`, чтобы у `entities/chat` появился второй потребитель — заменяется в
  Task 8)
- Modify: `steiger.config.ts`

- [x] `normalizePhone`; `createChatForm` (`reatomForm`, `name: "chat.createChatForm"`,
      `keepErrorOnChange: false`, `resetOnSubmit: true`, сброс ошибки сабмита при правке
      поля)
      (➕ ошибки ответа `checkAccount` — `CreateChatError` с `reason` `not-registered` /
      `instance-not-ready` в `create-chat-error.ts`, по образцу `LoginError`)
- [x] `onSubmit` по «Создание чата»: поиск по `phone` → `checkAccount` с `signal` из
      `abortVar.subscribe()` → проверка «клиент не сменился» → `openChat` / ошибка
- [x] `createChatErrorMessage(error)` по таблице
- [x] снять override для `entities/chat`
- [x] тесты: нормализация (`+7 (999) 123-45-67` → `79991234567`), валидация длины;
      существующий номер — без запроса (`calledMethods()` пуст), поле сброшено;
      `exist: true` — чат создан с `username`/`+номер` и выбран, поле сброшено; `chatId`
      уже есть — чат не дублируется, получает `phone`; ошибка — номер остаётся в поле
- [x] тесты ошибок: `exist: false`, `CheckAccountFailure`, `rate-limit` (`469` и `200`),
      `auth`, `network`, `http 400`, `http 466`; повторный сабмит отменяет первый
      (`hangUntilAbort`); `logout` посреди `checkAccount` (➕ `deferFetch` из Task 7 —
      если нужен раньше, завести здесь) — чат не создаётся
      (⚠️ `deferFetch` здесь не заведён: для одного теста хватило локального
      `deferResponse()` в `create-chat.test.ts`; общий хелпер — в Task 7)
- [x] `make check` — зелёный (➕ тест `ChatPage`: временный список названий по
      `sortedChatsAtom`)

### Task 7: модель отправки (`pages/chat`)

**Files:**
- Create: `src/pages/chat/model/send-message.ts`
- Create: `src/pages/chat/model/send-message.test.ts`
- Create: `src/pages/chat/model/active-chat.ts`
- Create: `src/pages/chat/model/active-chat.test.ts`
- Modify: `test/green-api.ts` (➕ `deferFetch`), `test/green-api.test.ts` если есть тесты
  хелперов
- Modify: `steiger.config.ts`

- [x] ➕ `deferFetch()` в `@test/green-api`: вызовы ждут `resolveNext(body, status?)` /
      `rejectNext(error)`, отклоняются с `signal.reason` при отмене
      (➕ `pending()` — число ждущих вызовов; `create-chat.test.ts` переведён с локального
      `deferResponse()` на `deferFetch`)
- [x] `activeMessagesAtom`
- [x] `sendChatMessage`, `retryChatMessage` по «Отправка» (`signal`, проверка клиента,
      ничего не пробрасывают; ⚠️ без клиента — синхронный `throw`, ошибка программиста);
      `draftField` (`reatomField`), `sendDraft`; сброс черновика
      при смене `activeChatIdAtom` (`withChangeHook`)
- [x] снять override для `entities/message` (потребители: `features/delete-chats`,
      `pages/chat`)
- [x] тесты: `sending` до ответа (`deferFetch`) → `sent` с `idMessage`; ошибка → `failed`;
      `retryChatMessage` → `sent` с тем же текстом; `touchChat` поднимает чат; две
      отправки подряд — обе `sending`, затем обе `sent` с **разными** `idMessage`; смена
      чата не отменяет отправку; `logout` посреди отправки — сообщения чата не
      воскрешаются
- [x] тесты: сброс кадра (`context.reset()`) посреди отправки (`hangUntilAbort`) — без
      unhandled rejection
      (⚠️ `context.reset()` не отменяет запрос: `wrap` отклоняется «context reset» только когда
      запрос завершится, с `hangUntilAbort` — по таймауту; тест — с `vi.useFakeTimers()`)
- [x] тест таймаута (`vi.useFakeTimers()` + `hangUntilAbort`): через `SEND_TIMEOUT` —
      `failed`; `retryChatMessage` зависшего сообщения обновляет `attemptAt` и доходит
      (⚠️ таймаут — `setTimeout` + `AbortController` с причиной `TimeoutError`, не
      `AbortSignal.timeout()`: тот не подчиняется fake timers; `request()` пробрасывает
      `signal.reason` как есть, `isAbort` узнаёт только `AbortError` — таймаут = `failed`)
- [x] тесты `sendDraft`: пустой/пробельный текст и отсутствие чата — без запроса;
      черновик сбрасывается сразу; смена чата (после `notify()`) сбрасывает черновик
      (➕ висячий `activeChatId` — тоже без запроса: `sendDraft` берёт `activeChatAtom`)
- [x] `activeMessagesAtom`: `[]` без чата и для чата без сообщений
- [x] `make check` — зелёный, overrides в `steiger.config.ts` не осталось

### Task 8: UI сайдбара и раскладка страницы

**Files:**
- Modify: `src/pages/chat/ui/chat-page.tsx`
- Modify: `src/pages/chat/ui/chat-page.module.css`
- Modify: `src/pages/chat/ui/chat-page.test.tsx`
- Create: `src/pages/chat/ui/sidebar.tsx` (+ `.module.css`)
- Create: `src/pages/chat/ui/create-chat-form.tsx` (+ тест)
- Create: `src/pages/chat/ui/chat-list.tsx` (+ `.module.css`, тест)

- [x] раскладка `sidebar | window` + мобильный режим `data-view` (окно — временно
      заглушка «Выберите чат…»); убрать временный список из Task 6
      (➕ при выбранном чате заглушка показывает его название как `h2` — иначе выбор не
      виден; ➕ `@media (width < $mantine-breakpoint-sm)` — граница совпадает с
      `hiddenFrom="sm"` для «←» в Task 9)
- [x] `Sidebar`: шапка (`AppTitle`, `LogoutButton`), `CreateChatForm`, `ChatList`
- [x] `CreateChatForm`: `TextInput` `type="tel"` + кнопка, лоадер/блокировка во время
      сабмита, ошибка под полем
- [x] `ChatList`: строки (название, последнее сообщение, время), активная подсвечена,
      клик выбирает; пусто — «Создайте чат по номеру телефона»
      (➕ строки — Mantine `NavLink component="button"` с `aria-current`; время —
      `src/pages/chat/lib/format-time.ts`: `HH:MM` сегодня, `DD.MM.YY` иначе; `formatTime`
      пригодится пузырю в Task 9)
- [x] тесты: создание чата по номеру появляется в списке и выбирается; ошибка «Номер не
      зарегистрирован в Telegram»; пустое состояние; выбор чата кликом; `data-view`
      переключается
- [x] `make check` — зелёный (➕ `app.test.tsx` ищет новую заглушку окна вместо «Чаты
      появятся здесь»)

### Task 9: UI окна чата

**Files:**
- Create: `src/pages/chat/ui/chat-window.tsx` (+ `.module.css`, тест)
- Create: `src/pages/chat/ui/message-bubble.tsx` (+ `.module.css`, тест)
- Create: `src/pages/chat/ui/composer.tsx` (+ `.module.css`, тест)
- Modify: `src/pages/chat/ui/chat-page.tsx`

- [x] `ChatWindow`: шапка («←» на узком экране, название, `DeleteChatButton`), лента с
      автоскроллом, `Composer`; без чата — «Выберите чат или создайте новый», пустая
      лента — «Сообщений пока нет»; `key` пузыря — `message.id`
      (➕ лента — `role="log"` «Сообщения»; автоскролл — `scrollTop = scrollHeight` по числу
      сообщений; стили окна переехали из `chat-page.module.css` в `chat-window.module.css`)
- [x] `MessageBubble`: сторона по `direction`, время `HH:MM`, статус; `failed` и
      `isSendingStale(message, Date.now())` — «Не отправлено» + «Повторить»
      (`retryChatMessage`)
      (➕ статусы с `aria-label` «Отправляется» / «Отправлено»; у входящих статуса нет;
      ⚠️ зависание `sending` проверяется при рендере — живая отправка своей вкладки станет
      `failed` по таймауту, чужая/после перезагрузки — при следующем рендере)
- [x] `Composer`: `Textarea` (`bindField(draftField)`, `autosize`, `maxLength={4096}`),
      `Enter` / `Shift+Enter` / IME, кнопка неактивна при пустом тексте
- [x] тесты: `Enter` отправляет и очищает поле, `Shift+Enter` — перенос; пустое — кнопка
      неактивна; `failed` → «Повторить» → `sent`; «←» возвращает к списку; удаление чата
      через `DeleteChatButton` возвращает к заглушке
- [x] `make check` — зелёный

### Task 10: Verify acceptance criteria

- [x] все требования Overview выполнены: чат по номеру, отправка со статусами, удаление,
      очистка при логауте, persist после перезагрузки, пустые состояния, мобильный режим
- [x] edge cases: висячий `activeChatId`, зависшее `sending` после перезагрузки, две
      отправки подряд, таймаут отправки, синхронизация вкладок, логаут посреди запроса, номер с `+` и пробелами, существующий номер без
      запроса
- [x] временное нарушение FSD (импорт `@/entities/chat` из `entities/message`) роняет
      `make lint-fsd`; откатить (проверено: `fsd/forbidden-imports`, откачено)
- [x] `make check` — зелёный; в `steiger.config.ts` нет временных overrides
- [x] покрытие: модели `entities/*`, `features/delete-chats`, `pages/chat/model` — все
      ветки ошибок из таблиц
      (➕ тест «логаут посреди отправки отбрасывает позднюю ошибку» — ветка `catch` со сменой
      клиента не была покрыта; ⚠️ провайдера покрытия нет — ветки сверены по тестам)

### Task 11: [Final] Update documentation

- [ ] дизайн-док: раскладка pages-first вместо `widgets/*` и `features/create-chat|
      send-message` (причина — `insignificant-slice`), `features/delete-chats`, очистка в
      `app`, `Chat.phone`, `shared/config` (`PERSIST_TTL`), синхронизация вкладок (таблица атомов),
      `attemptAt`/`SEND_TIMEOUT`, тексты ошибок create-chat, итог этапа 4 в «Этапах»
- [ ] дизайн-док, задачи для этапа 5: раскладка уведомлений через `openChat`/`touchChat`/
      `addMessage`; дедупликация по `idMessage` с учётом гонки — `outgoingAPIMessageReceived`
      может прийти раньше ответа `sendMessage`, пока у сообщения ещё `local-*` id;
      `logout` по `401`; **polling только во вкладке-лидере** —
      `navigator.locks.request("ga.polling", { signal }, …)` (Web Locks, без зависимостей):
      одна вкладка разбирает очередь и пишет, остальные получают данные через
      синхронизацию `localStorage`; лидер закрылся — лок переходит к следующей. Убрать из
      «Известных ограничений» пункт «вкладки конкурируют за очередь»
- [ ] `AGENTS.md`: точная семантика `insignificant-slice` (ссылка только из `app` — ок,
      `pages` не проверяются), pages-first, связка сущностей через фичу, очистка при
      логауте через `user-data-cleanup.ts`; change-хуки выполняются не синхронно
      (`notify()` в тестах); `withLocalStorage` по умолчанию вызывает `fromSnapshot` и
      после собственных записей — в нём только проверка формы; логаут не
      отменяет запросы в полёте — сверять клиент после `await`; `deferFetch`
- [ ] README — если уже есть раздел о возможностях
- [ ] переместить план в `docs/plans/completed/`

## Post-Completion

*Требует реального инстанса и Telegram — без чекбоксов*

**Ручная проверка:**
- логин → новый чат по своему номеру/номеру знакомого → сообщение доходит в Telegram;
  статус `sent`
- номер без Telegram → текст ошибки; повторный ввод существующего номера — без запроса
  (Network в DevTools)
- отключить сеть → `failed` → включить → «Повторить» → `sent`
- перезагрузка — чаты, выбор и сообщения на месте; «Выйти» → вход снова — список пуст
- две вкладки: чат, созданный в одной, появляется во второй; отправленное сообщение и
  его статус — тоже; выбор чата в одной не переключает другую; «Выйти» в одной — вторая
  тоже на логине, данные чисты
- закрыть вкладку сразу после отправки (медленная сеть в DevTools) — во второй вкладке
  сообщение через 30 с показывается «Не отправлено» (после любого перерендера)
- узкий экран (DevTools, 375px): список ↔ окно, «←»
- CORS на `checkAccount`/`sendMessage` из браузера (если не проявился на этапе 3)
