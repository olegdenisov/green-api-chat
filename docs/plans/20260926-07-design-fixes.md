# Этап 7: Палитра №4705, правки дизайна и статусы доставки

## Overview

- Три группы изменений:
  1. **Тема на палитре №4705** (color.romanuke.com: `#3C487C` `#797EBA` `#A7A0C9` `#F8D4C4`
     `#E5B1B9` — индиго, лаванда, персик, пудровый розовый) вместо синего акцента «по мотивам
     web.max.ru»: шкала `dawn`, своя тёмная шкала с оттенком индиго, токены `--ga-*`,
     захардкоженные цвета вне темы (`index.css`, `index.html`, favicon).
  2. **Правки по ревью дизайна (Claude Design)**: лента прижата к низу; неотправленное
     сообщение — мягкий розовый пузырь вместо ярко-красного; активная строка — тинт и полоса
     слева вместо сплошной заливки (красный аватар на синем больше не встречается: красного
     в палитре аватаров нет); «Нет сообщений» у пустого чата; светлый текст тёмной темы;
     «Новый чат» — кнопка «+» раскрывает форму; кнопка «Войти» по ширине полей; статусы —
     SVG вместо символов; понятный текст тоста про `webhookUrl`.
  3. **Статусы доставки**, как в мессенджерах: часы — отправляется, «✓» — отправлено, «✓✓» —
     доставлено, «✓✓» персиковым — прочитано. Источник — уведомление `outgoingMessageStatus` из
     очереди; при логине включается флаг `outgoingWebhook`. Только `delivered`/`read`: у
     `failed`/`noAccount` в документации нет `idMessage` — сообщение не найти, они
     игнорируются (ошибка отправки по-прежнему — из ответа `sendMessage`/таймаута).
- Задачи 1–3 — тема и стили; из не-стилевого там только текст «Нет сообщений» (задача 2) и
  выбор цвета аватара (задача 3). Статусы и форма — задачи 4–7.
- Итог: `make check` зелёный после каждой задачи; README, `AGENTS.md` и дизайн-документ
  описывают новую палитру, статусы и форму нового чата.

## Context (from discovery)

- Тема: `src/app/providers/theme.ts`, шкала `max`, `primaryShade: 7`, комментарий про
  web.max.ru; `cssVariablesResolver` — `--mantine-color-dimmed` и `--ga-*` (фон ленты,
  пузыри, день, тень). `theme.test.ts` проверяет, что **все** ключи `light` и `dark`
  совпадают: ключ только в одной схеме роняет тест.
- Цвета вне темы: `src/app/styles/index.css` (dark до монтирования: `#141518`/`#f1f3f5`,
  комментарий о дублировании), `index.html` (`theme-color` dark `#141518`),
  `public/favicon.svg` (`fill="#1f7bff"`).
- `src/pages/chat/ui/chat-list.module.css`: `[data-active]` — заливка
  `--mantine-primary-color-filled`, белый текст; `.time, .preview` в активной строке — белые;
  `.preview` резервирует строку (`min-height`) и пустой, если сообщений нет.
- `src/pages/chat/ui/message-bubble.module.css`: `.meta` через `opacity`; failed —
  `--mantine-color-red-filled` + белый. `message-bubble.tsx`: `OutgoingStatus` — «…»/«✓»
  (`span role="img"`) или «Не отправлено · Повторить».
- `src/pages/chat/ui/chat-avatar.tsx`: с инициалами — `color="initials"` (Mantine выбирает
  сам, в т.ч. красный), без — `PLACEHOLDER_COLORS` по хешу `chatId`, `autoContrast`.
- `src/pages/chat/ui/chat-window.module.css`: `.feed` — flex-колонка без прижатия к низу.
  `chat-window.tsx`: `Title order={2} size="h4"`.
- `sidebar.module.css`: `.logo` — `--mantine-primary-color-filled`. `sidebar.tsx`:
  `AppTitle size="h3"`, форма `CreateChatForm` всегда в `div.form`.
  `src/shared/ui/app-title.module.css`: `font-weight: 400`.
- `src/features/delete-chats/ui/delete-chat-button.tsx`: `ActionIcon color="red"` (стр. 28),
  «Удалить» в поповере — `color="red"`.
- `src/pages/chat/ui/composer.module.css`: `.send` без стиля disabled.
- `src/features/receive-messages/ui/connection-indicator.module.css`: жёлтая полоса
  `--mantine-color-yellow-light`.
- `src/features/auth/ui/login-form.tsx`: поля в `<Fieldset variant="unstyled">`; у
  `fieldset` UA-стиль `margin-inline: 2px` — отсюда «Войти» шире полей на 2px.
- Статусы: `Message.status` — `sending | sent | failed`, `STATUSES` проверяет форму persist
  (`src/entities/message/model/message.ts`). Union `Notification` в `src/shared/api/types.ts`
  — только сообщения. `parseNotification` → `ReceivedMessage | null`, `poll.ts` →
  `applyReceivedMessage`. `REQUIRED_FLAGS` в `notification-settings.ts` без
  `outgoingWebhook`; тост `webhookCleared` технический. `send-message.ts` после ответа
  ставит `sent` по локальному id — если уведомление уже сменило id, это no-op (понижения нет).
- `outgoingMessageStatus` (Telegram,
  https://green-api.com/telegram/docs/api/receiving/notifications-format/statuses/OutgoingMessageStatus/):
  `{ typeWebhook, chatId, instanceData, timestamp, idMessage?, status, description? }`;
  `status`: `delivered`, `read` (с `idMessage`, по каждому сообщению), `failed`, `noAccount`
  (в примерах **без** `idMessage`; у `noAccount` `chatId` вида `77777777777@c.us`). Нужен
  `outgoingWebhook` (вместе с `outgoingMessageWebhook`, `outgoingAPIMessageWebhook`).
- Фикстура статуса уже есть — `outgoingMessageStatus` в
  `test/fixtures/green-api/ignored-notifications.ts:8-21` (без типа); её импортируют
  `parse-notification.test.ts:10` (ожидает `null`, стр. 77) и `poll.test.ts:10` (тест
  «deletes an ignored notification», стр. 143, тело — стр. 46).
- `ensureNotificationSettings` вызывается только при логине (`login-form.ts:87`);
  `login-form.test.ts:281` проверяет текст тоста `stringContaining("webhookUrl очищен")`.
- Тесты, завязанные на всегда видимое поле «Номер телефона» и старые тексты:
  `sidebar.test.tsx:19,21`, `chat-page.test.tsx:26,44,51` и тест «does not steal focus»
  (стр. 98–114: поле — просто «другой» фокус), `app.test.tsx:87,176,184` (перелогин ждёт пустое
  поле), `chat-list.test.tsx:16` («Создайте чат по номеру телефона»),
  `chat-window.test.tsx:186` (`queryByText(/Не отправлено/)`), `icons.test.tsx` (`it.each`
  по всем иконкам). `Icon` в `icons.tsx` всегда `aria-hidden` — имя статуса на обёртке.
- Фокус: `ChatPage` (`chat-page.tsx:23-41`) переводит фокус только при уходе из чата
  (`activeChatId` → `null`, фокус на `<body>`); при открытии чата фокус никуда не
  переносится. `Sidebar` — обычный компонент, не `reatomComponent`.
- README: стр. 7, 25–29, 162 — «синий акцент», «подобраны на глаз», web.max.ru.
  `AGENTS.md`, раздел «Стили»: «палитра `max`», «подобрана на глаз, не снята с web.max.ru».

## Development Approach

- **testing approach**: Regular (код, затем тесты)
- complete each task fully before moving to the next
- make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
  - tests are not optional - they are a required part of the checklist
  - write unit tests for new functions/methods
  - write unit tests for modified functions/methods
  - add new test cases for new code paths
  - update existing test cases if behavior changes
  - tests cover both success and error scenarios
- **CRITICAL: all tests must pass before starting next task** - no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- run tests after each change (`make check` перед коммитом)
- maintain backward compatibility: сообщения из `localStorage` со старыми статусами
  читаются как раньше

## Testing Strategy

- **unit tests**: required for every task (see Development Approach above)
- **e2e tests**: в проекте нет. Цвета и раскладку (лента у низа, ширина «Войти», контраст)
  jsdom не считает — проверка вручную (Post-Completion). Тесты компонентов — по ролям,
  именам и атрибутам; тест темы — ключи и значения токенов.

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix
- update plan if implementation deviates from original scope
- keep plan in sync with actual work done

## Solution Overview

- **Тема.** Шкала `dawn` — `primaryColor`, `primaryShade: { light: 7, dark: 6 }`; своя шкала
  `dark` вместо нейтральной Mantine, чтобы хром и лента были из одного семейства. Все новые
  цвета — токены в `cssVariablesResolver`; модули и TSX ссылаются только на переменные.
- **Аватары — токены, не хардкод в TSX.** Пять пар `--ga-avatar-{1..5}-bg/-fg` в
  `cssVariablesResolver`: в `dark` первая пара — `#4f5a96` вместо `#3c487c`, остальные — как
  в `light`. Так тёмная тема меняет цвет без `useComputedColorScheme` (без мигания и без
  лишнего хука), а правило «цвета — только из темы» соблюдено. Цвет — по хешу `chatId` для
  всех аватаров (и с инициалами): он стабилен и не зависит от названия. Применение — через
  `vars` Mantine (`--avatar-bg`/`--avatar-color` на корне, их ставит `varsResolver` Avatar):
  `vars={() => ({ root: { "--avatar-bg": "var(--ga-avatar-N-bg)", "--avatar-color":
  "var(--ga-avatar-N-fg)" } })}`, `variant="filled"` сохраняется.
- **Ошибка отправки** — мягкий пузырь (`--ga-bubble-failed-*`: розовый тинт, рамка, тёмный
  текст) + SVG «!» и «Повторить» цветом `--ga-bubble-failed-meta`. Это снимает оба замечания
  ревью: пузырь не кричит, и его цвет не совпадает с цветом аватара (у пудрового аватара —
  заливка `#e5b1b9`, у ошибки — тинт `#fbe8eb` с рамкой).
- **Статусы в сущности `message`.** `Message.status`:
  `sending | sent | delivered | read | failed`. Одно правило: статус уведомления
  (`delivered`/`read`) применяется к исходящему `sent`/`delivered`, только если ранг выше
  (`sent < delivered < read`) — повтор из очереди и `delivered` после `read` ничего не
  меняют. `sending`/`failed` не трогаются: у них локальный id, уведомление их не найдёт.
- **Разбор в `features/receive-messages`.** `parseNotification` возвращает размеченный union
  (`kind: "message" | "status"`); `poll.ts` выбирает экшен по `kind`. Новый
  `applyMessageStatus` — `updateMessage` по `idMessage`; неизвестный чат/id — no-op. Он не
  вызывает `receiveChat`/`touchChat`: статус не создаёт чат и не меняет порядок списка.
  `failed`/`noAccount` (без `idMessage`) и прочие статусы → `null`, удаляются из очереди как
  игнорируемые.
- **Гонка с id.** Статус адресуется по `idMessage`. Локальное сообщение получает его из
  ответа `sendMessage` или из `outgoingAPIMessageReceived`, которое в очереди идёт раньше
  статуса. Статус, пришедший до того (редкий случай), теряется, остаётся «✓» — известное
  ограничение, без буфера.
- **Флаг только при логине.** `outgoingWebhook` включает `ensureNotificationSettings` при
  логине; у сессии, уже сохранённой в `localStorage`, статусов не будет до перелогина.
  Решение: не добавлять проверку настроек на старте — записать ограничение в README и
  дизайн-документ. Тост `updated` переформулировать нейтрально (не только «входящие»).
- **«Новый чат».** Атом `createChatOpenAtom` (`chatPage.createChatOpen`) в
  `pages/chat/model/create-chat.ts`. `ActionIcon` «+» в шапке сайдбара: `aria-label="Новый
  чат"`, `aria-expanded`, `aria-controls`. Открыта — форма над списком, фокус в поле.
  Закрытие: повторный «+» или Escape → `createChatForm.reset()` (отменяет запрос в полёте),
  фокус на «+». `resetChatPage` закрывает форму при логауте.
  - `Sidebar` становится `reatomComponent` и владеет всем: читает `createChatOpenAtom`, ref
    на «+», обёртка `div.form` с `id` смонтирована всегда (валидный `aria-controls`), внутри
    — `CreateChatForm` только когда открыта. Escape — `onKeyDown` на обёртке (обработчики —
    `wrap()`). `CreateChatForm` не меняется, кроме `autoFocus`/`data-autofocus` поля.
  - **Фокус после успешного сабмита.** Поле размонтируется, фокус падает на `<body>`.
    Решение — общее правило в `ChatPage` рядом с существующим эффектом: при переходе
    `activeChatId` на другой непустой чат, если фокус на `<body>`, перевести его в поле
    «Сообщение» (`textarea` композера, поиск по `aria-label` в корне страницы, как
    `[data-chat-id]` сейчас). Это заодно снимает известное ограничение из `AGENTS.md`
    («открытие чата на узком экране — фокус на `<body>`»). Фокус, который уже где-то стоит,
    не трогается.

## Technical Details

### Шкалы и тема (`theme.ts`)

```ts
// Палитра на основе color.romanuke.com №4705 (индиго, лаванда, персик, пудровый розовый).
const dawn: MantineColorsTuple = [
  "#eeeff7", "#dcdef0", "#b9bde0", "#979dcf", "#797eba",
  "#5f67a6", "#4f5a96", "#3c487c", "#323c68", "#283054",
];

// Холодная тёмная шкала с оттенком индиго вместо нейтральной Mantine dark (#242424 и т.д.),
// чтобы хром и лента были из одного семейства.
const dark: MantineColorsTuple = [
  "#ecebf5", "#c9c4e2", "#a7a0c9", "#8d8aa6", "#363a58",
  "#2c2f47", "#22253a", "#1a1c2b", "#141522", "#0f1019",
];

export const theme = createTheme({
  primaryColor: "dawn",
  primaryShade: { light: 7, dark: 6 },
  colors: { dawn, dark },
  fontFamily: /* без изменений */,
  defaultRadius: "md",
});
```

### Токены `cssVariablesResolver`

| Токен | light | dark |
|---|---|---|
| `--mantine-color-text` | `#1e2340` | `#ecebf5` |
| `--mantine-color-dimmed` | `#5c5f7a` (6.2:1 на белом) | `#a7a0c9` (~7:1 на `#1a1c2b`) |
| `--mantine-color-body` | `#ffffff` (ключ нужен в обеих схемах — тест) | `#1a1c2b` |
| `--mantine-color-default-border` | `#e4e1ee` | `#2c2f47` |
| `--mantine-color-default-hover` | `#f3f1f7` | `#2c2f47` (не `#22253a`: это `dark-6` = `--mantine-color-default`, у `variant="default"` пропал бы hover) |
| `--ga-feed-bg` | `#f3f1f7` | `#141522` |
| `--ga-bubble-in-bg` / `-text` / `-meta` | `#ffffff` / `#1e2340` / `#5c5f7a` | `#262a40` / `#ecebf5` / `#a7a0c9` |
| `--ga-bubble-out-bg` / `-text` / `-meta` | `#3c487c` (белый 8.7:1) / `#ffffff` / `#dcdef0` | `#4f5a96` (белый 6.5:1) / `#ffffff` / `#e4e5f3` |
| `--ga-bubble-failed-bg` / `-border` / `-text` / `-meta` | `#fbe8eb` / `#e5b1b9` / `#1e2340` / `#8a2537` | `#3a2233` / `#6a3a4c` / `#ecebf5` / `#e5b1b9` |
| `--ga-status-read` | `#f8d4c4` | `#f8d4c4` |
| `--ga-day-bg` / `-text` | `#f8d4c4` / `#6b4638` (5.9:1) | `rgba(248, 212, 196, 0.14)` / `#f8d4c4` |
| `--ga-bubble-shadow` | `rgba(30, 35, 64, 0.08)` | `rgba(0, 0, 0, 0.32)` |
| `--ga-row-active-bg` / `-bar` / `-time` | `#ebe9f4` / `#797eba` / `#3c487c` | `#272a45` / `#797eba` / `#c9c4e2` |
| `--ga-send-disabled-bg` / `-icon` | `#ebe9f4` / `#797eba` | `#272a45` / `#797eba` |
| `--ga-avatar-1-bg` / `-fg` | `#3c487c` / `#ffffff` | `#4f5a96` / `#ffffff` |
| `--ga-avatar-2-bg` / `-fg` | `#797eba` / `#ffffff` | то же |
| `--ga-avatar-3-bg` / `-fg` | `#a7a0c9` / `#1e2340` | то же |
| `--ga-avatar-4-bg` / `-fg` | `#f8d4c4` / `#3c487c` | то же |
| `--ga-avatar-5-bg` / `-fg` | `#e5b1b9` / `#1e2340` | то же |

`--ga-status-read` (персик на `#3c487c` — ≈6:1, на `#4f5a96` — ≈4.3:1; для графики нужно
≥ 3:1). Отправлено/доставлено — цвет `meta` пузыря.

### Стили

- `index.css`, dark до монтирования: `#1a1c2b` / `#ecebf5`; комментарий — дублирует
  `--mantine-color-body` и `--mantine-color-text` (dark) и `theme-color`.
- `index.html`: `theme-color` dark → `#1a1c2b`. `favicon.svg`: `fill="#3c487c"`.
- Активная строка:
  ```css
  &[data-active] {
    background: var(--ga-row-active-bg);
    color: var(--mantine-color-text);
    box-shadow: inset rem(3px) 0 0 var(--ga-row-active-bar);
    &:focus-visible { outline-color: var(--mantine-primary-color-filled); }
  }
  ```
  `.time, .preview` — без белого в активной строке; `.time` в активной:
  `color: var(--ga-row-active-time); font-weight: 600`.
- `.meta` пузыря — без `opacity`: входящий `--ga-bubble-in-meta`, исходящий
  `--ga-bubble-out-meta`, failed `--ga-bubble-failed-meta` + `font-weight: 500`. Failed:
  ```css
  .row[data-direction] &[data-failed] {
    background: var(--ga-bubble-failed-bg);
    color: var(--ga-bubble-failed-text);
    box-shadow: inset 0 0 0 rem(1px) var(--ga-bubble-failed-border);
  }
  ```
  Прежний комментарий неверен (белый на `#fa5252` — 3.3:1) — заменить. `.retry` —
  `color: inherit`, без изменений.
- Лента: `.feed > :first-child { margin-top: auto; }` — не `justify-content: flex-end` (с ним
  переполненный flex-контейнер не прокручивается к началу).
- Шапки: `.logo` — `--mantine-primary-color-filled` (в dark — `dawn.6`); `app-title.module.css`
  — `font-weight: 650; letter-spacing: -0.01em`; в сайдбаре `AppTitle size={rem(20)}` (пропом,
  не CSS: Mantine ставит `--title-fz` из `size`). `chat-window.tsx`: `Title … fw={650}`. `DeleteChatButton`: `ActionIcon
  color="gray"`, красный — только у «Удалить» в поповере.
- `composer.module.css`:
  ```css
  .send:disabled, .send[data-disabled] {
    background: var(--ga-send-disabled-bg);
    color: var(--ga-send-disabled-icon);
  }
  ```
- `connection-indicator.module.css`: `background: var(--ga-day-bg); color: var(--ga-day-text);`
  — персик вместо жёлтого (в спецификации по желанию; берём, жёлтый выбивается из палитры).
- Логин: `<Fieldset variant="unstyled" m={0} …>`.

### Статусы

- `Message["status"]`: `"sending" | "sent" | "delivered" | "read" | "failed"`; `STATUSES` —
  все пять.
- Правило применения (`applyMessageStatus`): сообщение исходящее, статус `sent`/`delivered`,
  ранг нового (`sent: 1, delivered: 2, read: 3`) выше — `updateMessage(..., { status })`;
  иначе no-op. Входящие, `sending`, `failed`, неизвестный чат или id — no-op.
- `types.ts`:
  ```ts
  export type OutgoingMessageStatusNotification = {
    typeWebhook: "outgoingMessageStatus";
    chatId: string;
    instanceData: InstanceData; // или поля, как в примере документации
    timestamp: number;
    /** Есть у `delivered`/`read`; у `failed`/`noAccount` в примерах документации — нет. */
    idMessage?: string;
    status: "delivered" | "read" | "failed" | "noAccount";
    description?: string;
  };
  ```
- `parseNotification`, ветка статуса: `status` — `delivered`/`read`, непустой `idMessage`,
  `chatId` — `PRIVATE_CHAT_ID`; иначе `null`. Деструктуризация полей сообщения
  (`senderData`, `messageData`) — после сужения по `typeWebhook`, иначе `Loose<Notification>`
  по union не даёт этих полей (TS2339).
- Фикстура `test/fixtures/green-api/outgoing-message-status.ts`: перенести
  `outgoingMessageStatus` из `ignored-notifications.ts` и добавить `read`, `failed`
  (`media caption too long`), `noAccount` — дословно из документации, с
  `satisfies OutgoingMessageStatusNotification`. Обновить комментарий
  `ignored-notifications.ts`.
- Иконки в `shared/ui/icons.tsx`: `IconClock`, `IconCheck`, `IconChecks`, `IconAlert`,
  `IconPlus` (если нет). Имена статусов (`role="img"` + `aria-label`): «Отправляется»,
  «Отправлено», «Доставлено», «Прочитано», «Не отправлено».
- Тосты: `updated` — «Настройки инстанса обновлены. Новые сообщения и статусы начнут
  приходить в течение ~5 минут»; `webhookCleared` — «Инстанс переключён на этот чат:
  прежний адрес для уведомлений отключён. Новые сообщения и статусы начнут приходить в
  течение ~5 минут».

## What Goes Where

- **Implementation Steps** (`[ ]` checkboxes): изменения кода, тесты, документация.
- **Post-Completion** (no checkboxes): ручная проверка в браузере и на реальном инстансе.

## Implementation Steps

### Task 1: Тема на палитре №4705
**Model:** sonnet — значения заданы планом, ключи проверяет тест

**Files:**
- Modify: `src/app/providers/theme.ts`
- Modify: `src/app/providers/theme.test.ts`
- Modify: `src/app/styles/index.css`
- Modify: `index.html`
- Modify: `public/favicon.svg`

- [x] шкалы `dawn` и `dark`, `primaryColor`/`primaryShade`/`colors`; новый комментарий-шапка
      вместо текста про web.max.ru
- [x] `cssVariablesResolver` — все токены из таблицы Technical Details (в т.ч.
      `--ga-status-read`, `--ga-bubble-*-meta`, `--ga-bubble-failed-*`, `--ga-row-active-*`,
      `--ga-send-disabled-*`, `--ga-avatar-{1..5}-*`; `--mantine-color-body` в обеих схемах)
- [x] `index.css` (dark `#1a1c2b`/`#ecebf5` + комментарий), `theme-color` dark `#1a1c2b`,
      favicon `#3c487c`
- [x] тест темы: ключи `light`/`dark` совпадают (существующий); `primaryColor === "dawn"`;
      `--mantine-color-text` в `dark` — `#ecebf5`; все 5 пар `--ga-avatar-*` в обеих схемах
- [x] `make check` — зелёный перед задачей 2

### Task 2: Хром по палитре и мелкие правки вёрстки
**Model:** sonnet — точные правки CSS и пропсов из плана

**Files:**
- Modify: `src/pages/chat/ui/chat-list.tsx`
- Modify: `src/pages/chat/ui/chat-list.module.css`
- Modify: `src/pages/chat/ui/chat-list.test.tsx`
- Modify: `src/pages/chat/ui/chat-window.module.css`
- Modify: `src/pages/chat/ui/chat-window.tsx`
- Modify: `src/pages/chat/ui/sidebar.tsx` (`AppTitle size`)
- Modify: `src/pages/chat/ui/sidebar.module.css`
- Modify: `src/shared/ui/app-title.module.css`
- Modify: `src/features/delete-chats/ui/delete-chat-button.tsx`
- Modify: `src/pages/chat/ui/composer.module.css`
- Modify: `src/features/receive-messages/ui/connection-indicator.module.css`
- Modify: `src/features/auth/ui/login-form.tsx`

- [x] активная строка — тинт + полоса, `.time` активной — `--ga-row-active-time`/600,
      превью остаётся `dimmed`
- [x] превью чата без сообщений — «Нет сообщений» (приглушённо, `.preview` уже `dimmed`)
- [x] лента `.feed > :first-child { margin-top: auto }`
- [x] шапки: `.logo`, `AppTitle` 650 + letter-spacing, `size={rem(20)}` в сайдбаре,
      `Title fw={650}` в окне чата; `DeleteChatButton` — `ActionIcon color="gray"`
- [x] `.send` disabled — токены; индикатор соединения — `--ga-day-*`
- [x] логин: `Fieldset m={0}`
- [x] тесты: у чата без сообщений в строке «Нет сообщений», у чата с сообщением — превью
      («Вы: …» для исходящего); существующие тесты `DeleteChatButton`/`ChatWindow`/логина
      зелёные (имена кнопок не менялись)
- [x] `make check` — зелёный перед задачей 3

### Task 3: Аватары на цветах палитры
**Model:** sonnet — схема токенов и способ применения заданы планом

**Files:**
- Modify: `src/pages/chat/ui/chat-avatar.tsx`
- Modify: `src/pages/chat/ui/chat-avatar.test.tsx`

- [x] убрать `PLACEHOLDER_COLORS`, `color="initials"`, `autoContrast`; `colorFor(chatId)` →
      индекс 1..5 по тому же хешу
- [x] фон и цвет — `vars` с `--avatar-bg`/`--avatar-color` = `var(--ga-avatar-N-*)` (Solution
      Overview); инициалы и заглушка для номера — как раньше
- [x] тесты (по `style` корня, как сейчас): один `chatId` — один и тот же токен; заглушка и
      инициалы используют `--ga-avatar-*`; инициалы из названия как раньше
- [x] `make check` — зелёный перед задачей 4

### Task 4: Статусы доставки в модели и настройках инстанса
**Model:** opus — модель данных, на которой строятся задачи 5–6

**Files:**
- Modify: `src/entities/message/model/message.ts`
- Modify: `src/entities/message/model/message.test.ts`
- Modify: `src/features/auth/model/notification-settings.ts`
- Modify: `src/features/auth/model/notification-settings.test.ts`
- Modify: `src/features/auth/model/login-form.test.ts` (стр. 281 — текст тоста)

- [ ] `Message["status"]` и `STATUSES`: `delivered`, `read`; JSDoc
- [ ] `outgoingWebhook` в `REQUIRED_FLAGS`; новые тексты тостов `updated`/`webhookCleared`
- [ ] тесты `toMessages`: `delivered`/`read` проходят, неизвестный статус отбрасывается
- [ ] тесты `ensureNotificationSettings`: `outgoingWebhook: "no"` → в патче; все `yes` →
      `"ok"`; `login-form.test.ts` — новый текст тоста
- [ ] `make check` — зелёный перед задачей 5

### Task 5: Тип, разбор и применение `outgoingMessageStatus`
**Model:** opus — порядок уведомлений и монотонность, ошибка проходит свои проверки

Тип в union добавляется здесь, а не в задаче 4: иначе `parse-notification.ts` не
типизируется, а перенос фикстуры ломает импорты тестов этой задачи.

**Files:**
- Modify: `src/shared/api/types.ts`
- Create: `test/fixtures/green-api/outgoing-message-status.ts`
- Modify: `test/fixtures/green-api/ignored-notifications.ts` (убрать `outgoingMessageStatus`,
  поправить комментарий)
- Modify: `src/features/receive-messages/model/parse-notification.ts`
- Modify: `src/features/receive-messages/model/parse-notification.test.ts` (импорт стр. 10,
  ожидание `null` стр. 77)
- Modify: `src/features/receive-messages/model/apply-notification.ts`
- Modify: `src/features/receive-messages/model/apply-notification.test.ts`
- Modify: `src/features/receive-messages/model/poll.ts`
- Modify: `src/features/receive-messages/model/poll.test.ts` (импорт стр. 10; тест «deletes an
  ignored notification» стр. 143 — тело на `incomingImageMessage`)

- [ ] `OutgoingMessageStatusNotification` (`idMessage?`) в `types.ts` и в union
      `Notification`; комментарий union
- [ ] фикстуры `delivered`, `read`, `failed`, `noAccount` дословно из документации, с
      `satisfies`
- [ ] `parseNotification` → размеченный union (`kind`), ветка статуса по Technical Details;
      сужение по `typeWebhook` до деструктуризации полей сообщения
- [ ] `applyMessageStatus` (`receiveMessages.applyStatus`): одно правило рангов; без
      `receiveChat`/`touchChat`
- [ ] `poll.ts`: экшен по `kind`; удаление из очереди — как для прочих уведомлений
- [ ] тесты разбора: `delivered`/`read` → статус; `failed`, `noAccount`, неизвестный
      статус, группа, пустой/отсутствующий `idMessage` → `null`; сообщения — как раньше
- [ ] тесты применения: `sent → delivered → read`; `read`, затем `delivered` — `read`;
      повтор — без изменений; `sending`/`failed`/входящее — no-op; неизвестный id или чат —
      чат не создаётся, порядок списка (`lastMessageAt`) не меняется
- [ ] тест цикла: `outgoingAPIMessageReceived` сопоставляет локальную отправку, затем
      `outgoingMessageStatus` делает её `delivered`; `failed` без `idMessage` удаляется из
      очереди и ничего не меняет
- [ ] `make check` — зелёный перед задачей 6

### Task 6: Пузырь — SVG-статусы, цвета meta и мягкая ошибка
**Model:** sonnet — вид и имена заданы планом, тесты по ролям

**Files:**
- Modify: `src/shared/ui/icons.tsx`
- Modify: `src/shared/ui/icons.test.tsx`
- Modify: `src/shared/ui/index.ts`
- Modify: `src/pages/chat/ui/message-bubble.tsx`
- Modify: `src/pages/chat/ui/message-bubble.module.css`
- Modify: `src/pages/chat/ui/message-bubble.test.tsx`
- Modify: `src/pages/chat/ui/chat-window.test.tsx` (стр. 186)

- [ ] иконки `IconClock`, `IconCheck`, `IconChecks`, `IconAlert` в стиле существующих;
      добавить в `it.each` `icons.test.tsx`
- [ ] `OutgoingStatus`: иконка внутри `span role="img" aria-label` («Отправляется»,
      «Отправлено», «Доставлено», «Прочитано») — SVG остаётся `aria-hidden`; прочитанное —
      `--ga-status-read`
- [ ] ошибка: `IconAlert` в `span role="img" aria-label="Не отправлено"` + «Повторить»;
      failed-пузырь и `.meta` — по Technical Details, без `opacity`; комментарий про контраст
      исправлен
- [ ] тесты: каждый статус — `getByRole("img", { name })`; «Повторить» вызывает повтор;
      устаревшее `sending` → «Не отправлено»; у входящего статуса нет;
      `chat-window.test.tsx:186` → `queryByRole("img", { name: "Не отправлено" })`
- [ ] `make check` — зелёный перед задачей 7

### Task 7: Кнопка «+» раскрывает форму нового чата
**Model:** opus — фокус, отмена сабмита и сброс при логауте должны сойтись

**Files:**
- Modify: `src/pages/chat/model/create-chat.ts`
- Modify: `src/pages/chat/model/create-chat.test.ts`
- Modify: `src/pages/chat/model/reset-chat-page.ts`
- Modify: `src/pages/chat/model/reset-chat-page.test.ts`
- Modify: `src/pages/chat/ui/sidebar.tsx`
- Modify: `src/pages/chat/ui/sidebar.module.css`
- Modify: `src/pages/chat/ui/sidebar.test.tsx` (стр. 19 `getByRole("textbox")`, стр. 21 текст)
- Modify: `src/pages/chat/ui/create-chat-form.tsx` (автофокус поля)
- Modify: `src/pages/chat/ui/chat-page.tsx` (фокус в «Сообщение» при открытии чата)
- Modify: `src/pages/chat/ui/chat-page.test.tsx` (стр. 26, 44, 51 — открыть «+»; тест «does
  not steal focus», стр. 98–114 — «другой» фокус на кнопке «Новый чат» вместо поля)
- Modify: `src/pages/chat/ui/chat-list.tsx` (текст пустого списка)
- Modify: `src/pages/chat/ui/chat-list.test.tsx` (стр. 16 — новый текст)
- Modify: `src/app/app.test.tsx` (стр. 87, 176 — открыть «+»; стр. 184 — после перелогина
  форма закрыта: `aria-expanded="false"`, поля нет)
- Modify: `src/shared/ui/icons.tsx`, `src/shared/ui/icons.test.tsx` (`IconPlus`)

- [ ] `createChatOpenAtom` (`chatPage.createChatOpen`, не persist); успешный `onSubmit` (и
      ветка известного номера) закрывает форму; `resetChatPage` закрывает
- [ ] `Sidebar` → `reatomComponent`: «+» (`aria-label="Новый чат"`, `aria-expanded`,
      `aria-controls` на всегда смонтированную обёртку), форма внутри — только открытой,
      фокус в поле
- [ ] Escape (`onKeyDown` на обёртке) и повторный «+»: `createChatForm.reset()`, закрыть,
      фокус на «+»
- [ ] `ChatPage`: при смене `activeChatId` на непустой, если фокус на `<body>`, — фокус в
      «Сообщение»; уже стоящий фокус не трогать
- [ ] пустой список: «Нажмите «+», чтобы начать чат по номеру телефона»
- [ ] тесты модели: успех закрывает, ошибка — нет; `resetChatPage` закрывает
- [ ] тесты UI: «+» открывает и фокусирует поле; Escape закрывает, фокус на «+», запрос в
      полёте отменён (`hangUntilAbort`); ошибка оставляет форму открытой; успех закрывает
      форму, открывает чат, фокус — в «Сообщение»; клик по строке чата при фокусе на строке
      фокус не переносит
- [ ] обновить перечисленные существующие тесты
- [ ] `make check` — зелёный перед задачей 8

### Task 8: Verify acceptance criteria
**Model:** sonnet — checks the result against the plan, fixes gaps

- [ ] все пункты Overview реализованы; в модулях и TSX нет хардкода цветов (grep
      `#[0-9a-fA-F]{3,6}` в `src/**/*.module.css` и `src/**/*.tsx`)
- [ ] edge cases: старые сообщения из `localStorage` читаются; статус для удалённого чата не
      создаёт чат; логаут закрывает форму нового чата
- [ ] `make check`
- [ ] `make build`

### Task 9: [Final] Update documentation
**Model:** sonnet — docs describe built behavior

- [ ] README: стр. 7, 25–29 — палитра №4705 вместо «синего акцента… на глаз»; стр. 162 —
      убрать web.max.ru; стр. 17 — статусы «отправляется / отправлено / доставлено /
      прочитано / не отправлено · Повторить», «+» для нового чата; ограничения: статусы
      только после перелогина у старой сессии, `failed`/`noAccount` не показываются, статус
      раньше id теряется
- [ ] `AGENTS.md`, «Стили»: палитра `dawn`, своя шкала `dark`, токены `--ga-*` (аватары,
      активная строка, failed, статусы), переопределения `--mantine-color-*`, дубли в
      `index.css`/`index.html`/favicon; A11y — имена статусов, «+» с `aria-expanded`, фокус
      при закрытии формы и при открытии чата (снять «известное ограничение» про узкий
      экран); `resetChatPage` — «и закрывает форму»; GREEN-API — `outgoingWebhook`,
      `outgoingMessageStatus` без `idMessage` у ошибок
- [ ] `docs/plans/20260923-telegram-chat-design.md`: статусы доставки, флаг
      `outgoingWebhook`, ограничения; текст пустого списка (стр. 367)
- [ ] move this plan to `docs/plans/completed/`

## Post-Completion

*Items requiring manual intervention or external systems - no checkboxes, informational only*

**Manual verification:**
- светлая и тёмная темы (`prefers-color-scheme`), десктоп и мобильная ширина: список,
  активный чат (тинт + полоса), отправка, ошибка + «Повторить», плашка дня, индикатор
  соединения, hover у `variant="default"` («Отмена» в поповере удаления), логин (фон,
  логотип, «Войти» индиго и по ширине полей), первый кадр до монтирования без вспышки
- короткий диалог стоит у поля ввода; длинный прокручивается к началу
- контраст: белый на `#3c487c` — 8.7:1, на `#4f5a96` — 6.5:1; `#8a2537` на `#fbe8eb` — 7.4:1;
  `#a7a0c9` на `#1a1c2b` — 6.8:1; `#6b4638` на `#f8d4c4` — 5.9:1. «Доставлено» (`#dcdef0`) и
  «Прочитано» (`#f8d4c4`) почти одной светлоты — различаются оттенком; проверить глазами
- реальный инстанс: «✓» → «✓✓» (получатель в сети) → «✓✓» персиком (прочитал); приходит ли
  `read` на каждое сообщение или только на последнее (если только на последнее — решить,
  повышать ли ранние); первый логин на инстансе с `outgoingWebhook: no` — тост
- «+» раскрывает форму; закрытая форма не сдвигает список; успешное создание — фокус в
  поле сообщения (в т.ч. на узком экране)
