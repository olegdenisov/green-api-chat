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
| `getSettings` | `GET` | настройки инстанса, в т.ч. `webhookUrl`, `incomingWebhook`, `outgoingAPIMessageWebhook`, `outgoingMessageWebhook`, `outgoingWebhook` (`"yes"`/`"no"`); `webhookUrl` должен быть пустым, иначе `receiveNotification`/`deleteNotification` отвечают `400` |
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
- `outgoingMessageStatus` (этап 7, статусы доставки): `{ typeWebhook, chatId, instanceData,
  timestamp, idMessage?, status, description? }`; `status` — `delivered`, `read` (оба с
  `idMessage`, по каждому сообщению), `failed`, `noAccount` (в примерах документации —
  **без** `idMessage`; у `noAccount` `chatId` вида `77777777777@c.us`). Требует флаг
  `outgoingWebhook` (вместе с `outgoingMessageWebhook`/`outgoingAPIMessageWebhook`).
  Обрабатываются только `delivered`/`read` с непустым `idMessage` — `failed`/`noAccount` не
  сопоставить с сообщением, событие просто удаляется из очереди.

### Решения по документации

- `receiveNotification` вызываем с `receiveTimeout=20`.
- Поддерживаем только личные чаты (`chatType` `user` или отсутствует, `chatId` — положительное
  целое); события из групп удаляем без обработки.
- Имя чата: `username` из `checkAccount` или номер; при входящем — обновляем на `chatName`.
- `setSettings` при логине — один запрос, только если есть что менять: включаем выключенные
  `incomingWebhook`/`outgoingMessageWebhook`/`outgoingAPIMessageWebhook`/`outgoingWebhook`
  (этап 7 — последний, нужен для статусов доставки) и очищаем непустой `webhookUrl` (иначе
  уведомления уходят на него, а не в очередь). Тост: входящие и статусы появятся в течение
  ~5 минут; если `webhookUrl` очищен — тост говорит и об этом. Сбой `getSettings`/`setSettings`
  (`ApiError`) логин не блокирует — предупреждающий тост. Флаг проверяется только при логине:
  у сессии, уже сохранённой в `localStorage` до этапа 7, статусов не будет до перелогина.
- `checkAccount` не повторяем автоматически; на `rate_limit_exceeded`/`469` — понятная ошибка.

### Непроверенное

- CORS при запросах из браузера. Проверено вручную на реальном инстансе после этапа 4
  (2026-09-26): `getStateInstance`, `getSettings`/`setSettings`, `checkAccount`,
  `sendMessage` работают без прокси; две вкладки и узкий экран — тоже. Не проверены
  `receiveNotification`/`deleteNotification` (этап 5); если CORS проявится там — варианты:
  Vite `server.proxy` с `router` по `apiUrl` для dev, прокси для прода.
  Этап 6: с домена деплоя не проверено — деплоя и репозитория на GitHub ещё нет (ручной
  шаг после сдачи, см. «Post-Completion» в плане этапа 6, `docs/plans/completed/` после
  публикации).
  Если опрос не заработает с домена Vercel — фолбэк: `rewrites` в `vercel.json` на хост
  GREEN-API по `idInstance` и `connect-src 'self'`.
- CI на GitHub и деплой Vercel (https://green-api-chat-three.vercel.app/) работают; CSP из
  `vercel.json` отдаётся, страница грузится без нарушений. Запросы к GREEN-API с домена
  деплоя и сценарий задания на реальном инстансе после этапа 6 не прогонялись.
- Палитра web.max.ru: снять через DevTools не удалось (навигация на внешний сайт была
  отклонена), цвета темы были подобраны на глаз (этап 6) — на этапе 7 заменены осознанной
  палитрой №4705 с color.romanuke.com, на этапе 8 — палитрой «Minimal Pastel» (макет 5a), см.
  этап 8 и раздел «Архитектура».

## Архитектура (FSD)

```
src/
  app/        провайдеры (Mantine, Reatom), тема (providers/theme.ts), глобальные стили,
              вход, выбор экрана;
              user-data-cleanup.ts — логаут ⇒ deleteAllChats() + resetChatPage(); нет
              кредов при старте ⇒ deleteAllChats()
  pages/
    login/    карточка с формой логина (LoginForm) и AppTitle (название приложения, h1)
    chat/     model: createChatForm, createChatOpenAtom (форма за «+», не persist),
              sendChatMessage/retryChatMessage, draftField/sendDraft,
              activeMessagesAtom; ui: Sidebar (CreateChatForm, ChatList), ChatWindow
              (MessageBubble, Composer, разделители дней), ChatAvatar, EmptyState; lib:
              formatTime (HH:MM), formatChatTime (сегодня — HH:MM, иначе DD.MM.YY),
              formatDayLabel («Сегодня» / «Вчера» / «25 сентября» / «3 января 2025»)
  features/
    auth/              форма логина (reatomForm: проверка инстанса, webhook-настройки,
                       сохранение кредов), кнопка «Выйти»
    delete-chats/      deleteChat (чат + история), deleteAllChats, DeleteChatButton
    receive-messages/  model: parseNotification (чистая, результат с kind: message |
                       status), applyReceivedMessage (раскладка с дедупликацией),
                       applyMessageStatus (статус доставки по idMessage, только
                       повышение ранга), pollNotifications (цикл, backoff), receiveStatusAtom
                       (статус, простой атом), pollingAtom (withConnectHook → Web Lock →
                       цикл); ui: ReceiveMessages (безголовый,
                       рендерит app), ConnectionIndicator (плашка «Переподключение…» в ChatPage)
  entities/
    session/   креды (credentialsAtom, persist), logout, greenApiAtom (клиент из кредов),
               requireApi (клиент или throw)
    chat/      Chat, chatsAtom, activeChatIdAtom, сортировка, openChat/receiveChat/touchChat/
               removeChat
    message/   Message, messagesAtom по chatId, addMessage/updateMessage/removeMessage, SEND_TIMEOUT,
               isSendingStale/sendingStaleAt, hasMessage
  shared/
    api/       клиент GREEN-API (fetch, типы, ApiError, опции { signal, timeout })
    config/    PERSIST_TTL (10 лет) — для session, chat, message
    ui/        инлайн-SVG иконки (icons: в т.ч.
               IconClock/IconCheck/IconChecks — статусы, IconPlus — «+»)
```

Тема: `src/app/providers/theme.ts` — `createTheme`, `variantColorResolver` и
`cssVariablesResolver` с токенами `--ga-*` (фон карточек/ленты/поля, пузыри, мягкий фон
активной строки и плашки дня, ошибка отправки, статусы, тень композера) для светлой и тёмной
схем; `MantineProvider defaultColorScheme="auto"` — схема по системной, переключателя нет. До
монтирования схему подхватывает CSS (`index.css`), скриптов нет — CSP без исключений для
`script-src`. Иконки — свои инлайн-SVG в `shared/ui/icons.tsx` (stroke 1.8, в т.ч. статусы
доставки), шрифты — системные, новых зависимостей нет.

Палитра (этап 8) — «Minimal Pastel» (макет 5a): шкала `lavender` (`primaryColor`, `[6]` =
`#6c5ce7`) и своя тёмная шкала `dark` с оттенком индиго вместо нейтральной шкалы Mantine;
тёмный primary `#b7adff` — переопределением `--mantine-color-lavender-filled` в
`cssVariablesResolver`, не через `primaryShade` (он красит все цвета шкалы). Заменила
палитру №4705 с color.romanuke.com (этап 7), которая заменяла подобранный на глаз синий акцент
«по мотивам web.max.ru» (этап 6). Цвета вне темы (`index.css`, `index.html` `theme-color`,
`favicon.svg`) продублированы из тех же токенов — см. `AGENTS.md`.

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
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' // этап 7: delivered/read
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
4. Таймаут `SEND_TIMEOUT` (30 с) — опция `timeout` клиента (этап 5) → `failed` (таймаут —
   `TimeoutError`, не отмена). Отправка,
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

Итог этапа 5 (`docs/plans/20260926-05-receive-messages.md`), слайс `features/receive-messages`.

1. **Жизненный цикл — `withConnectHook` на `pollingAtom`.** Подписчик — безголовый
   `ReceiveMessages` (рендерит `app` рядом с `ChatPage`, т.е. только при кредах).
   `ConnectionIndicator` читает `receiveStatusAtom` — простой атом без хука, опрос не
   запускает. Первый подписчик → `navigator.locks.request("ga.polling",
   { signal }, wrap(() => pollNotifications()))`; сам промис `request` — через `wrap()`,
   отмена гасится по `isAbort`. Логаут → экран логина → подписчиков нет → отключение отменяет
   ожидание лока, `wrap`/`sleep` и запросы цикла; лок переходит к следующей вкладке. Цикл, закончившийся сам (кредов нет, логаут, `401`),
   оставляет статус `idle`.
2. **Лидер** — одна вкладка разбирает очередь и пишет в атомы, остальные (`follower`) получают
   данные через синхронизацию `localStorage`. Нет `navigator.locks` (jsdom, старые браузеры)
   — опрос без лока, каждая вкладка сама.
3. **Цикл** (`pollNotifications`, в кадре хука): клиент — `greenApiAtom()` после получения
   лока, после каждого `await` сверяется, что он тот же. `receiveNotification({
   receiveTimeout: 20, timeout: 30 с })` → `null` → сразу повтор; событие →
   `parseNotification` → по `kind` результата (`"message"` → `applyReceivedMessage`, `"status"`
   → `applyMessageStatus`, `null` — игнорируется) → `deleteNotification` всегда (и для
   игнорируемых, и если раскладка бросила — иначе FIFO-очередь встанет; ошибка — в
   `console.error`). Сбой `delete` вернёт то же событие — раскладка идемпотентна.
4. **Ошибки**: отмена → тихий выход; `ApiError kind: "auth"` → тост «Сессия недействительна,
   войдите заново» + `logout()` (данные чистит хук `app/user-data-cleanup.ts`); прочее
   (`network`, `http`, `rate-limit`, `TimeoutError`) → backoff `min(1 с · 2^(n−1), 30 с)`
   (потолок 30 с и для `469` — сознательно, см. «Известные ограничения»), после 2 сбоев
   подряд — статус `reconnecting`; успешный ответ — сброс, `polling`.
5. **Разбор** (`parseNotification`, чистая функция, размеченный union по `kind`):
   `incomingMessageReceived` → `{ kind: "message", direction: "in" }`,
   `outgoingMessageReceived` → `{ kind: "message", direction: "out" }`,
   `outgoingAPIMessageReceived` → то же + `viaApi`; текст из
   `textMessage`/`extendedTextMessage`, медиа и прочие `typeWebhook` (кроме
   `outgoingMessageStatus`) — `null`; только личные чаты (`chatType` `user` или нет, `chatId`
   — положительное целое); битое тело → `null` без исключений; секунды → ms.
   `outgoingMessageStatus` с `status` `delivered`/`read` и непустым `idMessage` →
   `{ kind: "status", id: idMessage, status }`; `failed`/`noAccount` (без `idMessage` в
   документации), прочий статус или групповой `chatId` → `null`. Неизвестный `typeWebhook` —
   ветка `default` (без «ловушки» по union).
6. **Раскладка** (`applyReceivedMessage`): `receiveChat` (новое действие `entities/chat`: чата
   нет — создаётся, **не выбирается**, `title` — `chatName` или `chatId`; есть — обновляется
   `title` на непустое другое `chatName`, `phone` не трогается) → сообщение с таким `id` уже
   есть — только `touchChat` → для `viaApi` ищется ожидающая отправка с тем же текстом: самое
   старое исходящее `sending` (включая зависшие), нет — самое старое `failed`; найдено —
   `updateMessage({ id, status: "sent" })` → иначе `addMessage(sent)` → `touchChat`.
   Приоритет `sending`: иначе событие новой отправки пометило бы отправленным старое
   `failed` с тем же текстом. Отправка с телефона с ожидающими не сопоставляется.
7. **Защита `deliver()`**: ответ `sendMessage`, чей `idMessage` уже есть в чате (событие
   сопоставлено с другим локальным сообщением с тем же текстом), удаляет текущее локальное
   (`removeMessage` — новое действие `entities/message`), а не создаёт второй такой же id.
   Итог при двух одинаковых текстах — два сообщения с разными id.
8. **Статусы доставки** (этап 7, `applyMessageStatus`, `receiveMessages.applyStatus`):
   поднимает исходящее сообщение с найденным `idMessage` до `delivered`/`read` — только если
   новый ранг выше текущего (`sent < delivered < read`); повтор из очереди и `delivered`
   после `read` — no-op. Входящие, `sending`/`failed` (локальный id, статус их не найдёт),
   неизвестный чат или id — no-op; чат не создаётся и не поднимается в списке (без
   `receiveChat`/`touchChat`). Гонка: статус адресуется по `idMessage`, который сообщение
   получает из ответа `sendMessage` или предшествующего `outgoingAPIMessageReceived` —
   статус, пришедший раньше того и другого, теряется (сообщение остаётся с «✓»), буфера нет.

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
- Новый чат: форма скрыта за «+» в шапке списка (`aria-expanded`/`aria-controls`; открыта ли —
  `createChatOpenAtom`, не persist). Открытие — фокус в поле номера; Escape или повторный «+» —
  `createChatForm.reset()` (отменяет запрос в полёте), форма закрывается, фокус — на «+».
  Успех (и известный номер, в т.ч. уже открытого чата) закрывает форму, фокус — в
  «Сообщение»; ошибка оставляет форму открытой с номером; логаут (`resetChatPage`) закрывает.
  Номер → только цифры (10–15) → чат с таким `phone` есть — просто открывается,
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
- Polling: плашка «Переподключение…» (`ConnectionIndicator`) над карточками `ChatPage` — видна
  и на узком экране в окне чата — при серии ошибок (статус `reconnecting`), только у
  вкладки-лидера; `401`/`403` → логаут с тостом.
- Пустые состояния (общий `EmptyState`: иконка + текст): нет чатов → «Нажмите «+», чтобы начать
  чат по номеру телефона» (этап 7 — раньше без кнопки «+»); чат не выбран → «Выберите чат или
  создайте новый»; чат без сообщений → «Сообщений пока нет» (в строке списка для такого чата —
  «Нет сообщений»).

## Безопасность

**Что защищаем.** `apiTokenInstance` даёт полный доступ к инстансу: отправка от имени
аккаунта, чтение очереди уведомлений, смена настроек. История чатов в `localStorage` — тоже
личные данные.

**Угрозы:** XSS и вредоносные расширения браузера; общий или чужой компьютер; утечка токена
через логи, `Referer` и тексты ошибок; перехват трафика.

**Почему креды в `localStorage`.** Backend нет, запросы к GREEN-API идут из браузера, токен —
часть URL запроса. Альтернативы:

| Вариант | От чего защищает | Цена |
| --- | --- | --- |
| Кука, доступная JS | ни от чего сверх `localStorage` | уходит с каждым запросом к домену деплоя |
| `HttpOnly`-кука + прокси | XSS не узнаёт сам токен (но шлёт запросы через прокси) | нужен backend (задание — без него); прокси хранит или видит токен; нужна защита от CSRF |
| Память / `sessionStorage` | общий ПК (после закрытия вкладки) | вход после каждой перезагрузки или в каждой вкладке; ломаются синхронизация логаута и опрос под локом лидера (`storage`-события) |
| Шифрование WebCrypto (неизвлекаемый ключ в IndexedDB) | копирование файлов профиля | XSS расшифрует тем же ключом — видимость защиты |

Без backend место хранения от XSS не спасает: код на странице читает и хранилище, и память, и
может вызвать API сам. Поэтому защищаемся тем, чтобы XSS не появился, и не даём токену
утечь другими путями.

**Принятые меры:**

- CSP (`vercel.json`): `script-src 'self'` без inline-скриптов, `object-src 'none'`,
  `base-uri 'none'`, `frame-ancestors 'none'`.
- Текст сообщений выводится только как текст React; `dangerouslySetInnerHTML` нет.
- Только HTTPS: `connect-src https:` в CSP и валидатор `apiUrl` (`https://`) —
  токен в URL не уходит по открытому каналу.
- `Referrer-Policy: no-referrer`.
- `ApiError.message` без URL и токена.
- Поле токена — `PasswordInput` с `autoComplete="off"`.
- Креды сохраняются только после успешной проверки инстанса.
- Логаут стирает креды и историю во всех вкладках (`src/app/user-data-cleanup.ts`,
  синхронизация через `storage`).

**Остаточные риски:**

- XSS и расширения с доступом к сайту читают `localStorage`.
- На общем ПК креды и история живут до логаута (TTL persist — 10 лет, `PERSIST_TTL`).
- Токен виден в DevTools → Network — так устроен API GREEN-API.
- Уязвимые или вредоносные npm-зависимости.

**Если нужна настоящая защита:** backend-прокси с сессией в
`HttpOnly; Secure; SameSite=Strict`-куке, токен только на сервере. Для общего ПК — режим
«не запоминать» (креды только в памяти) или короткий TTL кредов (истёкшие креды при старте
удаляют и историю — `withInitHook` в `user-data-cleanup.ts`). Оба сознательно не делаем:
тестовое задание, выигрыш меньше цены в коде.

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
   Итог (`docs/plans/20260926-05-receive-messages.md`): опция `timeout` в `shared/api`
   (`deliver()` перешёл на неё); `receiveChat` и `removeMessage` в сущностях; запуск через
   `withConnectHook` + Web Lock `ga.polling` с фолбэком без лока; сопоставление
   API-событий с отправками по тексту (приоритет `sending`) и защита `deliver()` от дубля
   id; полоса «Соединение…» только у лидера. В тестах — стаб `stubWebLocks()`
   (`@test/web-locks`), `respondByMethod` с `"hang"` и массивом ответов, `calledUrls()`.
6. **Полировка и сдача** — вёрстка под web.max.ru, пустые состояния, компонентные тесты,
   README, деплой. Итог (`docs/plans/20260926-06-polish-and-release.md`): тема и токены
   `--ga-*`, тёмная схема по системной без скрипта, свои иконки в `shared/ui`, аватары с
   инициалами, разделители дней, кнопки-иконки с `aria-label`, фокус после «Назад»
   (Lighthouse accessibility 100 в обеих схемах), `vercel.json` (пресет `vite`, `corepack
   enable`, CSP), CI на GitHub Actions (Node 22/24). Палитру web.max.ru снять не удалось —
   цвета подобраны на глаз. CI, деплой и CSP проверены после этапа; CORS опроса на домене
   деплоя и сценарий на реальном инстансе не проверены — остаются на после сдачи.
7. **Палитра №4705, правки дизайна и статусы доставки.** Итог
   (`docs/plans/20260926-07-design-fixes.md`): подобранную на глаз тему сменила осознанная
   палитра №4705 с color.romanuke.com (`dawn` — индиго/лаванда/персик/пудровый розовый, своя
   тёмная шкала `dark`) — «палитра web.max.ru» и «подобраны на глаз» из этапа 6 больше не
   актуальны; правки по ревью дизайна (лента прижата к низу, мягкий розовый пузырь ошибки
   вместо ярко-красного, активная строка — тинт и полоса вместо заливки, аватары — цвета
   палитры по хешу `chatId` вместо инициалов/Mantine, «Нет сообщений» у пустого чата, кнопка
   «+» раскрывает форму нового чата); статусы доставки `delivered`/`read` из
   `outgoingMessageStatus` (флаг `outgoingWebhook`, только при логине), SVG-иконки статусов.
8. **Редизайн «Minimal Pastel» (макет 5a).** Итог
   (`docs/plans/20260927-08-pastel-redesign.md`): палитру №4705 сменила палитра «Minimal
   Pastel» — пастельные фоны и один насыщенный акцент `#6C5CE7` (шкала `lavender`,
   `primaryShade: { light: 6, dark: 8 }`, тёмный primary — override
   `--mantine-color-lavender-filled`); сайдбар и окно чата стали «плавающими» карточками
   (`--ga-surface`, радиус 22) на фоне `--ga-app-bg`; свой `variantColorResolver`
   (`--ga-on-primary` для текста на `filled`, вариант `field` для нейтральных иконок-кнопок);
   единый набор иконок stroke 1.8, новые `IconSearch`/`IconMessageCircle`/`IconArrowUp`/
   `IconArrowRight`/`IconRotateCcw`/`IconWifi`, удалены `IconLogo`/`IconSend`/`IconAlert`;
   заголовок сайдбара — `h1` «Чаты» (`AppTitle` остался только на логине); статус `failed` —
   видимый текст «Не отправлено» вместо `IconAlert role="img"`; индикатор соединения — pill
   «Переподключение…» вместо полосы «Соединение…». Известные ограничения — ниже.

## Известные ограничения (продублированы в README)

- Креды хранятся в браузере (см. «Безопасность»).
- Одновременные записи двух вкладок в одном тике теряют одну из них (атом пишется целиком).
- История до первого логина недоступна (кроме событий за последние 24 ч в очереди).
- Только текстовые сообщения.
- Индикатор «Переподключение…» — только у вкладки-лидера; ведомая проблем лидера не видит.
- Постоянная `http`-ошибка опроса (например, `400`, если `webhookUrl` выставили извне после
  логина) выглядит как вечное «Переподключение…».
- Свои API-отправки сопоставляются с событиями по точному тексту: если сервер нормализует
  текст — дубль.
- Запись лидера может затереть одновременную отправку в другой вкладке (сообщение вернётся
  через API-событие). Обратное тоже возможно: ведомая пишет `messagesAtom` (отправка, повтор)
  до прихода `storage`-события от лидера и затирает только что полученное им сообщение —
  потеря окончательная (уведомление уже удалено из очереди). Слияния по `storage` нет.
- После `401` лидер вызывает `logout()` и сразу отпускает лок: ведомая может получить его
  раньше `storage`-события о логауте и сделать ещё один запрос со старыми кредами — второй
  тост «Сессия недействительна» (после обычного логаута — один лишний long poll).
- Сопоставление с `failed` не ограничено по времени (событие может прийти через часы, если
  приложение было закрыто): отправка того же текста другим API-клиентом этого инстанса
  пометит настоящий `failed` отправленным.
- Смена кредов X → Y без размонтирования экрана чата (в приложении недостижима: логаут
  размонтирует экран) останавливает цикл, опрос возобновится только после переподписки.
- `469` в опросе ждёт максимум 30 с, а не часы: лимиты Telegram касаются `checkAccount`, для
  очереди уведомлений `469` не ожидается.
- События очереди за последние 24 ч воссоздают удалённый чат и появляются при первом входе.
- Статусы доставки (`outgoingMessageStatus`) начинают приходить только после перелогина: флаг
  `outgoingWebhook` включается в `setSettings` при входе, у уже сохранённой сессии не
  проверяется.
- `failed`/`noAccount` не отображаются статусом — в документации GREEN-API у них нет
  `idMessage`, сообщение не сопоставить (ошибка отправки по-прежнему видна из ответа
  `sendMessage`/таймаута, не из очереди).
- Статус, пришедший в очереди раньше, чем сообщению присвоен `idMessage` (ответ `sendMessage`
  или предшествующий `outgoingAPIMessageReceived`), теряется — сообщение остаётся с «✓», без
  буфера для более поздней сверки.
