# Telegram-чат на GREEN-API — дизайн

Тестовое задание «Фронтенд-разработчик React»: интерфейс отправки и получения текстовых
сообщений через GREEN-API. Мессенджер — Telegram (разрешён заданием вместо MAX).
Внешний вид — по мотивам https://web.max.ru/. Интерфейс максимально простой.

## Сценарий

1. Пользователь вводит `idInstance` и `apiTokenInstance`.
2. Вводит номер телефона получателя и создаёт чат.
3. Пишет текстовое сообщение и отправляет его.
4. Получатель отвечает в Telegram.
5. Пользователь видит ответ в чате.

## Стек

- Vite + React + TypeScript, pnpm, Node >= 22 (разработка на Node 24).
- Состояние: Reatom v1001 — `@reatom/core`, `@reatom/react`
  (`reatomComponent`, `wrap`, `useAction`, `reatomContext.Provider`).
- UI: Mantine 9 (контролы, `Notifications`, тема) + CSS Modules для вёрстки в стиле web.max.ru.
- Тесты: Vitest + Testing Library.
- Качество: oxlint, oxfmt, steiger (линтер FSD). Скрипт `check` запускает всё.
- Backend нет — запросы к GREEN-API идут из браузера.

## GREEN-API (Telegram)

Источник: https://green-api.com/telegram/docs/ (сверено 2026-09-23, повторно 2026-09-24 на этапе 2;
типы — `src/shared/api/types.ts`, примеры — `test/fixtures/green-api/`).

### Формат запроса

`{apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}` — сегмент `waInstance`
одинаков для Telegram и WhatsApp. Пример хоста: `https://4100.api.green-api.com` —
`apiUrl` подставляем по первым 4 цифрам `idInstance`, в форме логина можно переопределить
(значение есть в консоли GREEN-API).

### Методы

| метод | запрос | ответ |
| --- | --- | --- |
| `getStateInstance` | `GET` | `{ stateInstance }`: `authorized`, `notAuthorized`, `blocked`, `suspended`, `starting`, `pendingPassword` |
| `getSettings` | `GET` | настройки инстанса, в т.ч. `webhookUrl`, `incomingWebhook`, `outgoingAPIMessageWebhook`, `outgoingMessageWebhook` (`"yes"`/`"no"`); `webhookUrl` должен быть пустым, иначе `receiveNotification`/`deleteNotification` отвечают `400` |
| `setSettings` | `POST` любые из полей выше, кроме `wid`/`typeInstance` (хотя бы одно) | `{ saveSettings: true }`; **инстанс перезапускается, применение до 5 минут** |
| `checkAccount` | `POST { phoneNumber: number }` (только цифры, integer; API также принимает `username`/`force` — не используем) | `{ exist, chatId, username?, phoneNumber?, fromCache }`; нет аккаунта — `{ exist: false, chatId: "" }` |
| `sendMessage` | `POST { chatId, message }`, до 4096 символов | `{ idMessage }` |
| `receiveNotification` | `GET ?receiveTimeout=5..60` (по умолчанию 5) | `{ receiptId, body }` или пустой ответ (`null`) |
| `deleteNotification` | `DELETE .../deleteNotification/{token}/{receiptId}` | `{ result, reason }` |

Ошибки `checkAccount`: `400` — неверный формат номера; `200` с `rate_limit_exceeded` и
`469` — лимит Telegram (повтор через часы, не долбить); `500` — мессенджер недоступен.
Форма `200`-ошибок: лимит — `{ status: false, data: { status: "fail", reason:
"rate_limit_exceeded", retryAfter } }`; инстанс не готов — `{ status: false, reason:
"instance is starting or not authorized" }` (тип `CheckAccountFailure`).
Частые проверки несуществующих номеров приводят к временным ограничениям.

### Уведомления

Notification — событие инстанса (входящее/исходящее сообщение, статус, состояние аккаунта)
в серверной FIFO-очереди, хранится 24 ч. `Receive` не удаляет событие — пока не вызван
`Delete`, будет возвращаться одно и то же.

Нас интересуют (`body`):

```jsonc
{
  "typeWebhook": "incomingMessageReceived", // | outgoingMessageReceived | outgoingAPIMessageReceived
  "instanceData": { "idInstance": 4100000000, "wid": "...", "typeInstance": "telegram" },
  "timestamp": 1763115112, // секунды
  "idMessage": "1763115112345",
  "senderData": {
    "chatId": "10000000", // личный — положительное число, группа — отрицательное
    "chatType": "user", // user | supergroup | ...; в примере ReceiveNotification отсутствует — в типе optional
    "chatName": "...",
    "senderName": "...",
  },
  "messageData": {
    "typeMessage": "textMessage", // | extendedTextMessage (текст со ссылкой)
    "textMessageData": { "textMessage": "..." },
  },
}
```

- `chatId` в Telegram — число строкой, без `@c.us`.
- `outgoingMessageReceived` — отправлено с телефона/другого клиента, `outgoingAPIMessageReceived`
  — отправлено через API (в т.ч. нами — дедупликация по `idMessage`).
- `extendedTextMessage` — текст в `messageData.extendedTextMessageData.text` (сверено на этапе 2).
- Примеры исходящих уведомлений на страницах `OutgoingMessage`/`OutgoingApiMessage` опускают
  `messageData`; его форма — на странице `outgoing-message/TextMessage` (как у входящего
  `textMessage`).

### Решения по документации

- `receiveNotification` вызываем с `receiveTimeout=20`.
- Поддерживаем только личные чаты (`chatType === 'user'`); события из групп удаляем без обработки.
- Имя чата: `username` из `checkAccount` или номер; при входящем — обновляем на `chatName`.
- `setSettings` при логине — один запрос, только если есть что менять: включаем выключенные
  `incomingWebhook`/`outgoingMessageWebhook`/`outgoingAPIMessageWebhook` и очищаем непустой
  `webhookUrl` (иначе уведомления уходят на него, а не в очередь). Тост: входящие появятся в
  течение ~5 минут; если `webhookUrl` очищен — тост говорит и об этом. Сбой
  `getSettings`/`setSettings` (`ApiError`) логин не блокирует — предупреждающий тост.
- `checkAccount` не повторяем автоматически; на `rate_limit_exceeded`/`469` — понятная ошибка.

### Непроверенное

- CORS при запросах из браузера. Решили не проверять заранее; если проявится — вернёмся
  (варианты: Vite `server.proxy` с `router` по `apiUrl` для dev, прокси для прода).

## Архитектура (FSD)

```
src/
  app/        провайдеры (Mantine, Reatom), глобальные стили, вход, выбор экрана;
              user-data-cleanup.ts — логаут ⇒ deleteAllChats() + resetChatPage(); нет
              кредов при старте ⇒ deleteAllChats()
  pages/
    login/    карточка с формой логина (LoginForm)
    chat/     model: createChatForm, sendChatMessage/retryChatMessage, draftField/sendDraft,
              activeMessagesAtom; ui: Sidebar (CreateChatForm, ChatList), ChatWindow
              (MessageBubble, Composer); lib: formatTime (HH:MM), formatChatTime (сегодня —
              HH:MM, иначе DD.MM.YY)
  features/
    auth/              форма логина (reatomForm: проверка инстанса, webhook-настройки,
                       сохранение кредов), кнопка «Выйти»
    delete-chats/      deleteChat (чат + история), deleteAllChats, DeleteChatButton
    receive-messages/  цикл polling, раскладка уведомлений по чатам (этап 5)
  entities/
    session/   креды (credentialsAtom, persist), logout, greenApiAtom (клиент из кредов),
               requireApi (клиент или throw)
    chat/      Chat, chatsAtom, activeChatIdAtom, сортировка, openChat/touchChat/removeChat
    message/   Message, messagesAtom по chatId, addMessage/updateMessage, SEND_TIMEOUT,
               isSendingStale/sendingStaleAt
  shared/
    api/       клиент GREEN-API (fetch, типы, ApiError)
    config/    PERSIST_TTL (10 лет) — для session, chat, message
    ui/        мелкие общие компоненты (AppTitle)
```

Правила: импорт только сверху вниз, фичи не импортируют друг друга, доступ к слайсу — через
публичный `index.ts`. Пустые слои/сегменты не создаём. Границы проверяет steiger.

- **Pages-first (этап 4).** Изначально планировались `widgets/chat-list`,
  `widgets/chat-window`, `features/create-chat`, `features/send-message`, но у каждого — один
  потребитель, и steiger `fsd/insignificant-slice` их не пропускает (правило ругается на
  слайс без ссылок или с одной ссылкой из другого слайса; одна ссылка только из `app`
  допустима, слайсы `pages` не проверяются). Поэтому этот код живёт в `pages/chat` (подход
  FSD 2.1) и выносится, когда появится второй потребитель. `widgets` пока нет.
- **Сущности не знают друг о друге.** `chat` и `message` дают атомарные экшены
  (`removeChat`, `clearChats`, `removeChatMessages`, `clearMessages`); связку делает
  `features/delete-chats` (потребители — `pages/chat` и `app`).
- **Очистка при логауте — реакция в `app`**: `src/app/user-data-cleanup.ts` вешает
  `withChangeHook` на `credentialsAtom` (креды → `null` ⇒ `deleteAllChats()`). Любой логаут
  — кнопка, `401` из polling, логаут в другой вкладке — чистит данные без явных вызовов.
  Хук выполняется в фазе хуков, не синхронно внутри `logout`.

## Модель данных

```ts
type Chat = {
  chatId: string
  title: string // username из checkAccount или "+<phone>"; этап 5 обновит на chatName
  phone?: string // только цифры; нет у чатов, созданных входящим
  lastMessageAt: number // ms; для нового чата — время создания
}
type Message = {
  id: string // idMessage или `local-<uuid>` до ответа sendMessage
  chatId: string
  text: string
  direction: 'in' | 'out'
  status: 'sending' | 'sent' | 'failed'
  timestamp: number // ms (этап 5 переводит секунды GREEN-API в ms)
  attemptAt?: number // ms, начало последней попытки отправки; только у исходящих
}
```

`Chat.phone` нужен, чтобы существующий чат по номеру открывался без `checkAccount` (экономит
лимит Telegram).

Атомы (persist — `withLocalStorage({ key: "ga.<name>", time })` из `@reatom/core`; `time` по
умолчанию — `MAX_SAFE_TIMEOUT` (~24,8 суток), после чего запись считается просроченной и
атом возвращается к начальному значению. Для долгоживущих данных задаём большой конечный
`time` (10 лет; не `Infinity` — `JSON.stringify` превращает его в `null`, и запись сразу
просрочена):

- `credentialsAtom` (`entities/session`, ключ `ga.credentials`) — `{ idInstance,
  apiTokenInstance, apiUrl }` или `null`; пишется только после успешной проверки инстанса,
  `logout` сбрасывает в `null`. Сохранённое значение проверяется при чтении (`fromSnapshot`):
  не все три поля — непустые строки → `null`. Экран (логин/чат) выбирает `app` по этому атому, без роутера.
- `chatsAtom` (`ga.chats`) — `Record<chatId, Chat>`, persist.
- `activeChatIdAtom` (`ga.activeChatId`) — `string | null`, persist без синхронизации вкладок.
- `messagesAtom` (`ga.messages`) — `Record<chatId, Message[]>` в порядке добавления, persist.
- computed: `sortedChatsAtom` (по `lastMessageAt` убыв.), `activeChatAtom` (висячий id →
  `null`), `activeMessagesAtom` (в `pages/chat`), `greenApiAtom` (клиент из кредов или
  `null`).

`time` для всех — `PERSIST_TTL` из `shared/config` (10 лет).

Истории у GREEN-API нет (событие исчезает после `Delete`), поэтому всё храним в `localStorage`.

**`fromSnapshot` — только проверка формы, без преобразований.** `withLocalStorage` по
умолчанию подписан на хранилище и вызывает `fromSnapshot` и после собственных записей атома,
не только при старте. Битый элемент отбрасывается (не весь снапшот; элемент чата/сообщения
с `chatId`, не равным ключу записи, — тоже), `activeChatId` не строкой → `null`; корректный
снапшот возвращается тем же объектом.

**Синхронизация вкладок** — встроенная подписка `withLocalStorage` (событие `storage`):

| атом | синхронизация | почему |
| --- | --- | --- |
| `credentialsAtom` | да | логаут в одной вкладке — во всех (и очистка данных через хук) |
| `chatsAtom`, `messagesAtom` | да | новый чат и сообщения видны везде |
| `activeChatIdAtom` | нет (`subscribe: false`) | выбор чата у вкладки свой; иначе выбор в одной вкладке переключал бы другую и стирал её черновик |

Записи — целиком атом: одновременные записи двух вкладок в одном тике теряют одну из них.
От действий пользователя это практически не случается; для polling — одна вкладка-лидер
(этап 5).

## Потоки

### Отправка

1. Сообщение добавляется сразу со `status: 'sending'`, id `local-<uuid>` и `attemptAt`; чат
   поднимается (`touchChat`).
2. `sendMessage` → успех: id = `idMessage`, `sent`; ошибка: `failed` + «Повторить» на пузыре
   (`retryChatMessage`: тот же текст и временный id, новый `attemptAt`).
3. `sendChatMessage` — обычный `action`, не сабмит формы: смена чата, новая отправка и
   размонтирование окна его не отменяют; возвращённый промис не отклоняется (экшен
   вызывается без `await`); без клиента — синхронный `throw` (ошибка программиста: экран
   чата требует креды).
4. Таймаут `SEND_TIMEOUT` (30 с) → `failed` (таймаут — `TimeoutError`, не отмена). Отправка,
   прерванная закрытием вкладки или перезагрузкой, остаётся `sending`; `isSendingStale`
   (`now - attemptAt > SEND_TIMEOUT`) показывает её как `failed` (текст, «Повторить» и
   `data-failed` пузыря); пока такая отправка не зависла, пузырь держит одноразовый таймер на
   `sendingStaleAt(message)` (`attemptAt + SEND_TIMEOUT`, правило одно — в `entities/message`)
   и перерисовывается сам. Помечать
   `failed` при старте нельзя: другая вкладка пометила бы живую отправку → «Повторить» →
   дубль.
5. **Поздние ответы после логаута отбрасываются**: логаут не сбрасывает кадр и не отменяет
   запросы в полёте, поэтому после `await` модель сверяет, что `greenApiAtom()` — тот же
   клиент; `updateMessage` по неизвестному чату/id — no-op, удалённая история не
   воскресает. Так же — `checkAccount` в создании чата (и поздний ответ, и поздняя ошибка).
   Ответ применяется, только если у сообщения тот же `attemptAt`: поздний таймаут старой
   попытки не затирает повтор.
6. Поле ввода — `reatomField` (`draftField`); черновик один на все чаты и сбрасывается при
   смене активного чата.

### Получение

Цикл стартует после логина, останавливается при логауте (`AbortController`).

1. `receiveNotification` → `null` → повтор.
2. Событие разбирается по `typeWebhook`:
   - `incomingMessageReceived` с текстом → входящее сообщение; чата нет — создаётся.
   - `outgoing*MessageReceived` → исходящее, если нет сообщения с таким `idMessage`.
   - остальное (статусы, медиа) — игнор.
3. `deleteNotification(receiptId)` — всегда, включая игнорируемые события.
4. Сетевая ошибка → backoff; `401`/`403` → `logout()` из `entities/session` (данные чистит
   хук в `app/user-data-cleanup.ts`, отдельных вызовов не нужно).

Конкретные примитивы Reatom v1001 для цикла (effect, abort) — сверить по доке при реализации.

Задачи этапа 5 (по итогам этапа 4):

- Раскладка уведомлений — через готовые экшены сущностей: `openChat` (чата нет — создать;
  `title` — `chatName`), `touchChat(chatId, timestamp)`, `addMessage`; секунды GREEN-API →
  ms.
- Дедупликация по `idMessage` с учётом гонки: `outgoingAPIMessageReceived` может прийти
  раньше ответа `sendMessage`, пока у сообщения ещё `local-*` id. Нужно сопоставить
  событие с ожидающим `sending`-сообщением (или отложить разбор), иначе появится дубль.
- **Polling только во вкладке-лидере**: `navigator.locks.request("ga.polling", { signal },
  …)` (Web Locks, без зависимостей). Одна вкладка разбирает очередь и пишет в атомы,
  остальные получают данные через синхронизацию `localStorage`; лидер закрылся — лок
  переходит к следующей вкладке. `signal` — отмена при логауте.

## Ошибки и UI-состояния

- `ApiError { kind: 'auth' | 'network' | 'rate-limit' | 'http', status? }` — единый тип в
  `shared/api`, UI различает ошибки по `kind`. `rate-limit` — `469` и `rate_limit_exceeded`
  (лимиты Telegram на `checkAccount`): из `469` — `status: 469`; из `200`/`rate_limit_exceeded`
  — без `status`, исходный ответ (`CheckAccountFailure` с `data.retryAfter`) — в `cause`.
  Отмена запроса (`AbortSignal`) не заворачивается в `ApiError` — пробрасывается причина
  отмены (`signal.reason`, обычно `AbortError`) без изменений, чтобы Reatom-отмена
  (`isAbort`) работала.
- Прочие случаи клиента (этап 2): сбой `fetch` или чтения тела → `network` (исходная ошибка
  в `cause`); `401`/`403` → `auth`; прочие не-2xx и невалидный JSON → `http` со `status`.
  `466` (лимит тарифа/квоты GREEN-API) — тоже `http` со `status: 466`, отдельного `kind` нет;
  UI может показать его отдельно по `status`.
  Пустое тело `2xx` — `null` только у `receiveNotification` (пустая очередь); у остальных
  методов — `ApiError { kind: 'http' }`. `checkAccount` с `200`-ошибкой, кроме лимита,
  возвращается как есть (`CheckAccountFailure`) — разбирает этап 4.
- Логин: `getStateInstance` → `authorized` пускаем; прочие статусы и ошибки запросов —
  текстом в `Alert` над кнопкой (полная таблица — «Тексты ошибок» в
  `docs/plans/20260925-03-auth.md`: `notAuthorized`/`pendingPassword` и неизвестный статус →
  «Инстанс не авторизован в Telegram», `blocked`/`suspended`, `starting`, `401`/`403` →
  «Неверный idInstance или apiTokenInstance», сеть, `http`, `rate-limit`, прочее → «Не
  удалось войти»). Лоадер, форма заблокирована; во время повторной попытки `Alert` скрыт,
  после правки любого поля — исчезает. Включение webhook-настроек при необходимости. Ошибки
  валидации — у полей; провал валидации `Alert` не даёт (узнаётся по тождеству с
  `loginForm.validation.trigger.error()`). `apiUrl` — только `https://` (токен идёт в URL).
- Новый чат: номер → только цифры (10–15) → чат с таким `phone` есть — просто открывается,
  без запроса; иначе `checkAccount`. `chatId` из ответа уже есть (чат пришёл входящим) —
  открывается существующий, `phone` дописывается. Поле сбрасывается только при успехе.
  Ошибки — под полем (`pages/chat/model/create-chat-error.ts`):

  | причина | текст |
  | --- | --- |
  | `exist: false` | Номер не зарегистрирован в Telegram |
  | `rate-limit` | Слишком много проверок номеров, попробуйте позже |
  | `CheckAccountFailure` | Инстанс не готов, попробуйте позже |
  | `http` `400` | Неверный формат номера |
  | `http` `466` | Исчерпан лимит тарифа GREEN-API |
  | `auth` | Доступ запрещён. Выйдите и войдите заново |
  | `network` | Нет связи с GREEN-API |
  | прочее | Не удалось проверить номер |

- Удаление чата — кнопка в шапке окна, подтверждение в `Popover` («Удалить чат и
  историю?» → «Удалить»).
- Отправка: неактивна при пустом тексте, `Enter` — отправить, `Shift+Enter` — перенос,
  лимит 4096 на клиенте.
- Polling: индикатор «соединение…» в шапке при серии сетевых ошибок; `401`/`403` → логаут с тостом.
- Пустые состояния: нет чатов → «Создайте чат по номеру телефона»; чат не выбран → заглушка.

## Тесты

- Парсер уведомлений: входящий текст, свой исходящий (дубль по `idMessage`), игнор-типы.
- Polling-цикл с моком `fetch`: `null` → повтор, событие → обработка → `delete`,
  ошибка → backoff, `401` → логаут, abort → остановка.
- Отправка: оптимистичное добавление → `sent`/`failed` → retry.
- `create-chat`: нормализация номера, нет аккаунта, чат уже есть.
- Компонентные: форма логина, отправка по `Enter`.

## Этапы

Каждый этап — отдельный план в `docs/plans/`, создаётся перед выполнением с учётом
результатов предыдущих. После каждого этапа приложение в рабочем состоянии.

1. **Скаффолд** — git, `AGENTS.md`, Vite/React/TS/pnpm, oxlint, oxfmt, steiger, Vitest,
   Mantine, Reatom, FSD-скелет, Makefile. Спайка нет — API сверено по документации.
2. **`shared/api`** — клиент GREEN-API (фабрика `createGreenApi(creds)`), `ApiError`,
   `apiUrl`, типы ответов и уведомлений, unit-тесты на фикстурах из примеров документации.
   Первый ручной запрос к реальному инстансу покажет, есть ли проблема с CORS.
   `shared/lib` не нужен: persist — встроенный `withLocalStorage` из `@reatom/core`
   (с `version`/`migration`), подключается к атомам сущностей на этапах 3–4.
3. **Auth** — `features/auth`, `pages/login`, проверка инстанса, webhook-настройки, логаут.
   Итог (`docs/plans/20260925-03-auth.md`): креды и `logout` — в `entities/session`;
   `features/auth` — `loginForm` (`reatomForm`, повторный сабмит отменяет предыдущий,
   поля очищаются после входа), `LoginForm`, `LogoutButton`; настройки включаются одним
   `setSettings` с тостом, их сбой логин не блокирует; `pages/login`, `pages/chat`
   (заглушка), выбор экрана в `app`. На этап 4 перенесены: `greenApiAtom` (клиент из
   кредов) и очистка чатов/сообщений при логауте.
4. **Чаты и отправка** — `entities/chat`, `entities/message`, `features/delete-chats`,
   `pages/chat`. Итог (`docs/plans/20260925-04-chats-and-sending.md`): раскладка
   pages-first вместо `widgets/*` и `features/create-chat|send-message` (причина —
   `insignificant-slice`); `greenApiAtom` в `entities/session`, `PERSIST_TTL` в
   `shared/config`; очистка при логауте — `app/user-data-cleanup.ts`; чат по номеру
   (существующий — без запроса), оптимистичная отправка с таймаутом и «Повторить»,
   удаление чата с историей; сайдбар + окно, на узком экране — одна колонка с «←»;
   синхронизация вкладок через `localStorage`. В тестах — хелпер `deferFetch()` в
   `@test/green-api`.
5. **Получение** — `features/receive-messages`: парсер, polling, backoff, abort, дедупликация.
6. **Полировка и сдача** — вёрстка под web.max.ru, пустые состояния, компонентные тесты,
   README, деплой.

## Известные ограничения (в README на этапе 6)

- Креды хранятся в браузере.
- Одновременные записи двух вкладок в одном тике теряют одну из них (атом пишется целиком).
- История до первого логина недоступна (кроме событий за последние 24 ч в очереди).
- Только текстовые сообщения.
