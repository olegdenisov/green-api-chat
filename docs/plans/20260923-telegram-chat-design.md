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

Источник: https://green-api.com/telegram/docs/ (сверено 2026-09-23).

### Формат запроса

`{apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}` — сегмент `waInstance`
одинаков для Telegram и WhatsApp. Пример хоста: `https://4100.api.green-api.com` —
`apiUrl` подставляем по первым 4 цифрам `idInstance`, в форме логина можно переопределить
(значение есть в консоли GREEN-API).

### Методы

| метод | запрос | ответ |
| --- | --- | --- |
| `getStateInstance` | `GET` | `{ stateInstance }`: `authorized`, `notAuthorized`, `blocked`, `suspended`, `starting`, `pendingPassword` |
| `getSettings` | `GET` | настройки инстанса, в т.ч. `webhookUrl`, `incomingWebhook`, `outgoingAPIMessageWebhook`, `outgoingMessageWebhook` (`"yes"`/`"no"`) |
| `setSettings` | `POST` любые из полей выше | `{ saveSettings: true }`; **инстанс перезапускается, применение до 5 минут** |
| `checkAccount` | `POST { phoneNumber: number }` (только цифры, integer) | `{ exist, chatId, username?, phoneNumber?, fromCache }`; нет аккаунта — `{ exist: false, chatId: "" }` |
| `sendMessage` | `POST { chatId, message }`, до 4096 символов | `{ idMessage }` |
| `receiveNotification` | `GET ?receiveTimeout=5..60` (по умолчанию 5) | `{ receiptId, body }` или пустой ответ (`null`) |
| `deleteNotification` | `DELETE .../deleteNotification/{token}/{receiptId}` | `{ result, reason }` |

Ошибки `checkAccount`: `400` — неверный формат номера; `200` с `rate_limit_exceeded` и
`469` — лимит Telegram (повтор через часы, не долбить); `500` — мессенджер недоступен.
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
    "chatType": "user", // user | supergroup | ...
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
- `extendedTextMessage` — поле с текстом сверить по странице
  `notifications-format/incoming-message/ExtendedTextMessage` при реализации этапа 5.

### Решения по документации

- `receiveNotification` вызываем с `receiveTimeout=20`.
- Поддерживаем только личные чаты (`chatType === 'user'`); события из групп удаляем без обработки.
- Имя чата: `username` из `checkAccount` или номер; при входящем — обновляем на `chatName`.
- `setSettings` при логине вызываем только если нужные флаги выключены, и предупреждаем
  пользователя, что входящие появятся в течение ~5 минут.
- `checkAccount` не повторяем автоматически; на `rate_limit_exceeded`/`469` — понятная ошибка.

### Непроверенное

- CORS при запросах из браузера. Решили не проверять заранее; если проявится — вернёмся
  (варианты: Vite `server.proxy` с `router` по `apiUrl` для dev, прокси для прода).

## Архитектура (FSD)

```
src/
  app/        провайдеры (Mantine, Reatom), глобальные стили, вход
  pages/
    login/    форма idInstance + apiTokenInstance
    chat/     сборка сайдбара и окна чата
  widgets/
    chat-list/     список чатов + кнопка «новый чат»
    chat-window/   шапка, лента сообщений, поле ввода
  features/
    auth/              логин/логаут, хранение кредов
    create-chat/       номер → checkAccount → chatId → новый чат
    send-message/      оптимистичная отправка + статус
    receive-messages/  цикл polling, раскладка уведомлений по чатам
  entities/
    chat/      атомы чатов, выбранный чат, тип Chat
    message/   сообщения по chatId, тип Message
  shared/
    api/       клиент GREEN-API (fetch, типы, ApiError)
    lib/       утилиты — только когда появятся (persist — встроенный withLocalStorage)
    ui/        мелкие общие компоненты
```

Правила: импорт только сверху вниз, фичи не импортируют друг друга, доступ к слайсу — через
публичный `index.ts`. Пустые слои/сегменты не создаём. Границы проверяет steiger.

## Модель данных

```ts
type Chat = { chatId: string; title: string; lastMessageAt: number }
type Message = {
  id: string // idMessage или временный id
  chatId: string
  text: string
  direction: 'in' | 'out'
  status: 'sending' | 'sent' | 'failed'
  timestamp: number
}
```

Атомы (persist — `.extend(withLocalStorage("ga.<name>"))` из `@reatom/core`):

- `credentialsAtom` — `{ idInstance, apiTokenInstance, apiUrl }`, persist, чистится при логауте.
- `chatsAtom` — `Record<chatId, Chat>`, persist.
- `activeChatIdAtom` — persist.
- `messagesAtom` — `Record<chatId, Message[]>`, persist.
- computed: отсортированный список чатов, сообщения активного чата.

Истории у GREEN-API нет (событие исчезает после `Delete`), поэтому всё храним в `localStorage`.

## Потоки

### Отправка

1. Сообщение добавляется сразу со `status: 'sending'` и временным id.
2. `sendMessage` → успех: id = `idMessage`, `sent`; ошибка: `failed` + «повторить» на пузыре.

### Получение

Цикл стартует после логина, останавливается при логауте (`AbortController`).

1. `receiveNotification` → `null` → повтор.
2. Событие разбирается по `typeWebhook`:
   - `incomingMessageReceived` с текстом → входящее сообщение; чата нет — создаётся.
   - `outgoing*MessageReceived` → исходящее, если нет сообщения с таким `idMessage`.
   - остальное (статусы, медиа) — игнор.
3. `deleteNotification(receiptId)` — всегда, включая игнорируемые события.
4. Сетевая ошибка → backoff; `401`/`403` → логаут.

Конкретные примитивы Reatom v1001 для цикла (effect, abort) — сверить по доке при реализации.

## Ошибки и UI-состояния

- `ApiError { kind: 'auth' | 'network' | 'rate-limit' | 'http', status? }` — единый тип в
  `shared/api`, UI различает ошибки по `kind`. `rate-limit` — `469` и `rate_limit_exceeded`
  (лимиты Telegram на `checkAccount`). Отмена запроса (`AbortSignal`) не заворачивается в
  `ApiError` — пробрасывается исходная `AbortError`, чтобы Reatom-отмена (`isAbort`) работала.
- Логин: `getStateInstance` → `authorized` пускаем; иной статус → «Инстанс не авторизован
  в Telegram»; `401`/`403` → «Неверный idInstance или apiTokenInstance». Лоадер, форма
  заблокирована. Включение webhook-настроек при необходимости.
- Новый чат: номер → только цифры → `checkAccount`; нет аккаунта → «Номер не
  зарегистрирован в Telegram»; существующий чат — просто открывается.
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
4. **Чаты и отправка** — `entities/chat`, `entities/message`, `features/create-chat`,
   `features/send-message`, `widgets/chat-list`, `widgets/chat-window`.
5. **Получение** — `features/receive-messages`: парсер, polling, backoff, abort, дедупликация.
6. **Полировка и сдача** — вёрстка под web.max.ru, пустые состояния, компонентные тесты,
   README, деплой.

## Известные ограничения (в README)

- Креды хранятся в браузере.
- Несколько вкладок конкурируют за одну очередь уведомлений.
- История до первого логина недоступна (кроме событий за последние 24 ч в очереди).
- Только текстовые сообщения.
