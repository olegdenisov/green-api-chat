# Этап 8: Редизайн «Minimal Pastel» (макет 5a)

## Overview

- Визуальный редизайн по брифу `pastel-redesign-brief.md` и макету 5a
  (`pastel-5a-reference.png`; в задаче 1 оба переезжают из `handoff/` в `docs/design/pastel-5a/`):
  1. палитра: пастельные фоны и один насыщенный акцент `#6C5CE7` (dark — `#B7ADFF` с тёмным
     текстом);
  2. форма: сайдбар и чат — «плавающие» карточки на лавандовом фоне, крупные радиусы,
     аватары-скруглённые квадраты, тень только у композера;
  3. единый набор линейных иконок (stroke 1.8, round);
  4. рестайл существующих элементов: шапка сайдбара, форма нового чата, список, шапка чата,
     пузыри и статусы, плашка дня, композер-«пилюля», логин, индикатор соединения;
  5. светлая и тёмная темы из одной системы токенов.
- **Только scope A (визуал).** Scope B не делаем — оценка ниже, в разделе «Scope B».
- Каждая задача — отдельный коммит, приложение работоспособно после каждой, `make check`
  зелёный.

## Итоги аудита (код против брифа)

- **Статусы доставки есть все**: `Message.status` — `sending | sent | delivered | read |
  failed` (`src/entities/message/model/message.ts`), `delivered`/`read` приходят через
  `outgoingMessageStatus`. Сокращать до pending/sent/failed (раздел 6 брифа) не нужно.
  Отличие от брифа: `delivered` — `check-check` цветом меты, `read` — `check-check` primary
  (бриф красит оба в primary; тогда «доставлено» и «прочитано» не различить).
- **Иконки уже свои** (`src/shared/ui/icons.tsx`, инлайн-SVG, viewBox 24, round), но
  `strokeWidth={2}`. Решение: оставить свои SVG (AGENTS.md — без новых зависимостей),
  stroke 1.8, дорисовать недостающие по путям Lucide. Нужны только используемые:
  `IconSearch` (поле нового чата), `IconMessageCircle` (логотип), `IconArrowUp` (отправка),
  `IconArrowRight` («Создать» — не путать с отправкой), `IconRotateCcw` (повтор), `IconWifi`
  (индикатор). `paperclip`, `smile`, `more-horizontal`, `user`, `x` — только для scope B, не
  добавляем (YAGNI). `IconLogo` (потребители: `sidebar.tsx`, `login-page.tsx`,
  `empty-state.tsx`), `IconSend`, `IconAlert` удаляются в задаче 8, когда потребителей не
  останется.
- **Шапка сайдбара** сейчас — логотип + `AppTitle` («GREEN-API chat», `h1`). По брифу —
  «Чаты». Решение: в `ChatPage` `h1` — «Чаты» (`Title order={1}` в `sidebar.tsx`); `AppTitle`
  остаётся на логине, бренд — там и в `<title>`. Ломаются `sidebar.test.tsx:30-33` и
  `chat-page.test.tsx:25` — обновляются в задаче 4.
- **Индикатор соединения** показывается только при `reconnecting` — так и оставляем, меняется
  вид и текст: pill warning «Переподключение…» вместо полосы «Соединение…». Ломается
  `app.test.tsx:353` — обновляется в задаче 8.
- **Mantine: тёмный текст на primary в dark не получается штатно.** У варианта `filled`
  `defaultVariantColorsResolver` жёстко ставит `color: var(--mantine-color-white)`;
  `autoContrast` берёт светлый оттенок (схему не учитывает) — текст остаётся белым, а белый на
  `#B7ADFF` — 2.01:1. Нужен свой `variantColorResolver` с токеном `--ga-on-primary`.
- **Mantine: `primaryShade` действует на все цвета.** `primaryShade.dark: 3` сделал бы в dark
  `red-filled` = `#ff8787` (белый — 2.32:1, кнопка «Удалить»), так же для тостов. Поэтому
  `primaryShade: { light: 6, dark: 8 }` (дефолт Mantine для dark), а `#B7ADFF` в dark — через
  переопределение `--mantine-color-lavender-filled`/`-filled-hover` в `cssVariablesResolver`
  (бриф 2.4 это допускает).
- **Контраст — расхождения с критерием брифа (≥ 4.5:1):**
  - время активной строки primary `#6C5CE7` на `#F1EEFF` — 4.26:1. Берём
    `--ga-primary-soft-text` `#5A4BC9` (5.61:1);
  - `#8A879C` (placeholder) на белом — 3.48:1. Время неактивных строк — `dimmed`; этот цвет —
    только плейсхолдеры (`--mantine-color-placeholder`) и иконка disabled-кнопки;
  - ошибки полей Mantine — `--mantine-color-error` (red-6 `#fa5252`, 3.28:1 на белом, 2.96:1 на
    field-bg). Переопределяем на `#b42336` / `#ff9aa6`.
- **Тема** (`src/app/providers/theme.ts`): шкала `dawn`, своя `dark`, ~30 токенов `--ga-*`.
  Часть токенов уходит, появляются новые (списки — в Technical Details).
  `--ga-bubble-out-text` остаётся, но переезжает из `variables` (`#ffffff`) в `light`/`dark`
  с цветом ink — сразу в задаче 1, иначе текст исходящих станет белым на `#E9E5FF`.
- **Хардкод вне темы**: `src/app/styles/index.css` (dark body до монтирования `#1a1c2b`/
  `#ecebf5`), `index.html` (`theme-color` `#ffffff`/`#1a1c2b`), `public/favicon.svg`
  (`#3c487c`).
- **Удаление чата**: `DeleteChatButton` — `ActionIcon color="red"`; по брифу кнопка в шапке
  нейтральная (field-bg), красный только в подтверждении поповера.
- **Фокус строк чата**: строки на всю ширину `nav` с `overflow-y: auto`, внешнее кольцо
  обрежется — сейчас там `outline-offset: -2px` (`chat-list.module.css:24-27`). Кольцо строк
  — внутреннее (`inset`), в `chat-list.module.css`, не глобальным правилом в `app`.

## Scope B — оценка (не делаем в этом этапе)

| Функция | Данные | Объём | Рекомендация |
|---|---|---|---|
| Фильтр списка по имени/номеру | локально есть (`title`, `chatId`) | S | делать отдельным этапом, если нужно |
| Чипы «Все / Непрочитанные / Группы» | нет флагов unread и group у `Chat`; групп в модели нет (чат создаётся по номеру) | L | не делать |
| Бейдж непрочитанных | нужен persist `lastReadAt` в `entities/chat` + очистка в `user-data-cleanup` | M | возможно позже |
| «В сети» | GREEN-API для Telegram не отдаёт | — | не делать |
| Скрепка / эмодзи | отправка только текста | S (disabled-заглушки) | не делать: вводят в заблуждение |
| Поиск по переписке | локально есть | M | не делать |

## Context (from discovery)

- Тема: `src/app/providers/theme.ts` (`dawn`, `dark`, `primaryShade: { light: 7, dark: 6 }`,
  `defaultRadius: "md"`, `cssVariablesResolver`), `theme.test.ts` (ключи `light`/`dark`
  совпадают и не повторяют `variables`; пять пар аватаров; текст dark `#ecebf5`; тест
  «gives the first avatar a lighter tint in dark» — `:47-52`).
- `src/app/providers/ui-provider.tsx` — `MantineProvider` с темой и резолвером.
- Каркас: `src/pages/chat/ui/chat-page.module.css` — grid `320px | 1fr`, узкий экран
  `< $mantine-breakpoint-sm` (48em = 768px) — одна колонка по `data-view`; индикатор — полоса в
  `.root` над `.page`.
- Сайдбар: `sidebar.tsx/.module.css` (логотип, `AppTitle`, «+» `ActionIcon`
  `variant={open ? "light" : "subtle"}` с `aria-expanded`/`aria-controls`, `LogoutButton` из
  `features/auth`), `create-chat-form.tsx` (`TextInput` + `Button` «Создать», `readOnly` в
  ожидании).
- Список: `chat-list.tsx/.module.css` (`button[data-chat-id][data-active]`, аватар 48,
  время, превью «Вы: …»). Аватар: `chat-avatar.tsx` — `Avatar variant="filled"` + `vars`
  `--ga-avatar-N-bg/-fg`, хеш по `chatId`, `AVATAR_COLOR_COUNT = 5`.
- Окно: `chat-window.tsx/.module.css` (назад `hiddenFrom="sm"`, аватар 40, `Title order={2}`,
  `DeleteChatButton`, `Feed` с плашкой дня `.day/.dayLabel`), `empty-state.tsx/.module.css`
  (`IconLogo`).
- Пузыри: `message-bubble.tsx/.module.css` — `STATUS_VIEW` (`role="img"` + `aria-label`),
  failed — `IconAlert` `role="img"` «Не отправлено» · кнопка «Повторить». Тесты:
  `message-bubble.test.tsx:72,104`, `chat-window.test.tsx:186` ищут `role="img"` «Не
  отправлено».
- Композер: `composer.tsx/.module.css` — `Textarea autosize` + `ActionIcon` 36 `radius="xl"`
  с `IconSend`, disabled через `--ga-send-disabled-*`.
- Логин: `src/pages/login/ui/login-page.tsx/.module.css` (`Paper withBorder shadow="sm"`,
  `IconLogo`), `src/features/auth/ui/login-form.tsx`, `logout-button.tsx`.
- Индикатор: `src/features/receive-messages/ui/connection-indicator.tsx/.module.css`
  (`Loader` + «Соединение…»).
- Удаление: `src/features/delete-chats/ui/delete-chat-button.tsx` (`ActionIcon color="red"`,
  «Удалить» `Button color="red"` в поповере).
- Иконки: `src/shared/ui/icons.tsx`, `icons.test.tsx`, `index.ts`.
- Mantine 9.6.2: `defaultVariantColorsResolver`
  (`node_modules/@mantine/core/esm/core/MantineProvider/color-functions/default-variant-colors-resolver/`),
  `get-css-color-variables.mjs`, `styles/Input.css` (`[data-error]`/`:focus` задают
  `--input-bd`), `theme.focusClassName`.
- Документация со старой палитрой и «Соединение…»: `README.md:25-27,169-171`,
  `docs/plans/20260923-telegram-chat-design.md:130,158,180,404,504,531-533`, `AGENTS.md`
  («Стили»).

## Development Approach

- **testing approach**: Regular (код, затем тесты) — работа в основном в CSS; тесты
  проверяют разметку, роли и имена, токены темы, то, что рендерит резолвер Mantine, и контраст.
- complete each task fully before moving to the next
- make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task** — `make check`
- **CRITICAL: update this plan file when scope changes during implementation**
- A11y не ухудшать: `aria-label` у иконок-кнопок, роли статусов, фокус по правилам AGENTS.md,
  тесты ищут по ролям/именам, не по классам.
- Цвета — только в `theme.ts` (плюс `index.css`/`index.html`/`favicon.svg` с комментарием о
  дублировании). В `*.module.css` — только `var(--mantine-*)`/`var(--ga-*)`.
- После каждой задачи — визуальная сверка с макетом 5a в обеих схемах (`make dev`,
  DevTools → Rendering → `prefers-color-scheme`), ширины 1280 и 375.

## Testing Strategy

- **unit tests**: Vitest + Testing Library, рядом с кодом; e2e-тестов в проекте нет.
- Контраст — хелпер в `theme.test.ts` (WCAG relative luminance), ключевые пары «текст / фон»
  в обеих схемах. Для кнопок — проверять не пару цветов, а то, что возвращает
  `fullTheme.variantColorResolver(...)` (токен), и контраст значений этого токена.

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix
- update plan if implementation deviates from original scope

## Solution Overview

- **Токены — единственный источник цвета.** Задача 1 задаёт финальный набор токенов и
  шкалы; старые токены, которые ещё читают модули, временно остаются (со значениями из
  новой палитры), чтобы приложение не ломалось между задачами. Задача 9 удаляет
  неиспользуемые.
- **Mantine-компоненты стилизуются через тему** (задача 2): `variantColorResolver`
  (текст на primary, вариант `field` для иконок-кнопок), `theme.components` (`ActionIcon`,
  `Input`, `Button`, `Popover`, `Notification`), `focusClassName`. Модули страниц только
  выбирают вариант.
- **Иконки** — свои SVG, API экспорта `@/shared/ui` сохраняется, добавляются новые имена.
- Поведение (модели, фокус, формы, отмена) не меняется; меняются разметка оформления,
  CSS Modules и тема.

## Technical Details

### Шкалы Mantine

```ts
// [6] = #6C5CE7 (primary light), [3] = #B7ADFF (primary dark — через cssVariablesResolver),
// [4] = #9A8CF7 (hover primary в dark), [7] = #5A4BC9 (soft text), [8] = #4A3BB5 (аватар-1 fg).
const lavender: MantineColorsTuple = [
  "#f3f1ff", "#e9e5ff", "#d4ccff", "#b7adff", "#9a8cf7",
  "#8374ef", "#6c5ce7", "#5a4bc9", "#4a3bb5", "#3a2d94",
];
// dark[7] — surface (= body в dark), [8] — feed, [9] — app-bg; [6] — --mantine-color-default.
const dark: MantineColorsTuple = [
  "#eeecf6", "#c9c6d8", "#a6a3b8", "#8c89a0", "#3a3848",
  "#2e2c3a", "#24232f", "#1b1a24", "#16151e", "#121119",
];
```

- `primaryColor: "lavender"`, `primaryShade: { light: 6, dark: 8 }`, `defaultRadius: 14`.
- В `dark` резолвера: `--mantine-color-lavender-filled: #b7adff`,
  `--mantine-color-lavender-filled-hover: #9a8cf7` (сверить, что
  `--mantine-primary-color-filled` ссылается на них; если нет — переопределить и его).
- `variantColorResolver`: обёртка над `defaultVariantColorsResolver`:
  - `variant === "filled"` и цвет — primary (`lavender` или не задан) → `color:
    "var(--ga-on-primary)"` (`#ffffff` light / `#1d1b2e` dark; на hover `#9a8cf7` — 5.98:1);
  - `variant === "field"` (свой вариант для `ActionIcon`) → `background: var(--ga-field-bg)`,
    `hover: var(--mantine-color-default-hover)`, `color: var(--mantine-color-text)`, `border:
    none`. Используется в logout, «Назад», удалении чата — определяется один раз.
- `Input.extend({ defaultProps: { variant: "filled" }, vars: () => ({ wrapper: {
  "--input-bg": "var(--ga-field-bg)" } }) })` — у `filled` рамка прозрачная, на фокусе primary,
  на ошибке — error; `--input-bd` не трогать (иначе пропадут рамки ошибки и фокуса). Композер
  явно ставит `variant="unstyled"`.
- Фокус: `theme.focusClassName` → класс в `src/app/styles/index.css` с `:focus-visible {
  outline: none; box-shadow: 0 0 0 2px var(--mantine-primary-color-filled), 0 0 0 5px
  var(--ga-bubble-out-bg) }`. Строки чата — своё внутреннее кольцо в `chat-list.module.css`
  (`inset`). Поле композера — кольцо на «пилюле» через `:focus-within`.

### Токены (`cssVariablesResolver`)

| Токен | light | dark |
|---|---|---|
| `--ga-app-bg` | `#f7f5fc` | `#121119` |
| `--ga-surface` | `#ffffff` | `#1b1a24` |
| `--ga-feed-bg` | `#fbfafe` | `#16151e` |
| `--ga-field-bg` | `#f4f2fa` | `#24232f` |
| `--ga-border` | `#f0eef6` | `#26252f` |
| `--ga-on-primary` | `#ffffff` | `#1d1b2e` |
| `--mantine-color-text` | `#1d1b2e` | `#eeecf6` |
| `--mantine-color-dimmed` | `#6b6880` | `#a6a3b8` |
| `--mantine-color-body` | `#ffffff` | `#1b1a24` |
| `--mantine-color-placeholder` | `#8a879c` | `#8c89a0` |
| `--mantine-color-error` | `#b42336` | `#ff9aa6` |
| `--mantine-color-default-border` | `#e4e0f2` | `#34323f` |
| `--mantine-color-default-hover` | `#ebe8f5` | `#2e2c3a` (≠ `dark[6]`, иначе `variant="default"` без hover) |
| `--ga-primary-soft` | `#f1eeff` | `#2a2640` |
| `--ga-primary-soft-text` | `#5a4bc9` | `#c9c1ff` |
| `--ga-bubble-in-bg` / `-text` / `-meta` | `#ffffff` / `#1d1b2e` / `#6b6880` | `#24232f` / `#eeecf6` / `#a6a3b8` |
| `--ga-bubble-out-bg` / `-text` / `-meta` | `#e9e5ff` / `#1d1b2e` / `#5e5a7a` | `#3a3366` / `#f4f2ff` / `#c9c1ff` |
| `--ga-bubble-failed-bg` | `#ffe0e3` | `#3d2229` |
| `--ga-danger-text` | `#b42336` | `#ff9aa6` |
| `--ga-status-read` | `#6c5ce7` | `#b7adff` |
| `--ga-warning-bg` / `-text` | `#fff1c2` / `#7a5a00` | `#3a3120` / `#ffd98a` |
| `--ga-day-bg` / `-text` | `#f1eeff` / `#5a4bc9` | `#2a2640` / `#c9c1ff` |
| `--ga-composer-shadow` | `rgba(60, 50, 120, 0.08)` | `rgba(0, 0, 0, 0.32)` |
| `--ga-avatar-{1..5}-bg/-fg` (`variables`, обе схемы) | `#e9e5ff/#4a3bb5` · `#ffe3d3/#8a3e1b` · `#d7f5e6/#1c6b4a` · `#dcebff/#1f4e8c` · `#fff1c2/#7a5a00` | те же |

- Значения dark для `--mantine-color-default-border`, `--ga-warning-*`,
  `--ga-composer-shadow` в брифе не заданы — выбраны в тон; контраст-тест их проверяет.
- `--ga-placeholder`, `--ga-border-strong`, `--ga-online*` не заводим: первые два заменяет
  Mantine-переменная / нет потребителя, третий — scope B.
- Удаляемые в задаче 9 (если никто не читает): `--ga-row-active-*`, `--ga-bubble-shadow`,
  `--ga-bubble-failed-border`, `--ga-bubble-failed-text`, `--ga-bubble-failed-meta`,
  `--ga-notice-*`, `--ga-send-disabled-*`.

### Размеры

- Каркас: фон `--ga-app-bg`, `padding: 12px`, `gap: 12px`; карточки `--ga-surface`,
  `border-radius: 22px`, `overflow: hidden`, без теней и рамок. `< 48em`: без отступа и
  радиуса, карточка на весь экран.
- Радиусы: пузыри 20 (хвост 6: исходящие — нижний правый, входящие — нижний левый),
  аватар в списке 46/16, в шапке 42/14 (проп `radius` у `ChatAvatar`), поля и кнопки 14,
  иконки-кнопки 38/12, pill 999.
- Типографика: «Чаты» 18/650, имя в шапке 16/650, имя в строке 15/600, превью 13.5, мета
  11.5–12.

## What Goes Where

- **Implementation Steps** — код, тесты, документация в репозитории.
- **Post-Completion** — ручная сверка с макетом, проверка на деплое.

## Implementation Steps

### Task 1: Палитра и токены (M)
**Model:** opus — задаёт токены, на которых строятся все задачи; контраст легко получить «зелёным», но неверным

**Files:**
- Create: `docs/design/pastel-5a/` (перенос `handoff/pastel-redesign-brief.md`, `handoff/pastel-5a-reference.png`)
- Modify: `src/app/providers/theme.ts`
- Modify: `src/app/providers/theme.test.ts`
- Modify: `src/app/styles/index.css`
- Modify: `index.html`
- Modify: `public/favicon.svg`

- [x] перенести `handoff/*` в `docs/design/pastel-5a/` (файлы не в git: обычный перенос + `git add`), удалить `handoff/`
- [x] шкалы `lavender` и `dark` из Technical Details, `primaryColor: "lavender"`, `primaryShade: { light: 6, dark: 8 }`, `defaultRadius: 14`; комментарий о палитре 5a вместо №4705
- [x] `cssVariablesResolver`: токены из таблицы, включая `--mantine-color-error`/`-placeholder` и `--mantine-color-lavender-filled`/`-filled-hover` в `dark`; `--ga-bubble-out-text` — из `variables` в `light`/`dark` (ink); `--ga-avatar-1-bg` — из `light`/`dark` в `variables`; старые токены, которые ещё читают модули, — со значениями новой палитры
- [x] `index.css`: фон страницы и dark до монтирования — app-bg `#121119` / текст `#eeecf6` (то же, что корень чата и `theme-color`, без вспышки); `index.html` `theme-color` `#f7f5fc`/`#121119`; `favicon.svg` `#6c5ce7`; комментарии о дублировании обновить
- [x] тесты темы: `primaryColor` — `lavender`, `[6]` = `#6c5ce7`, `[3]` = `#b7adff`; текст dark `#eeecf6`; пять пар аватаров в `variables`; ключи `light`/`dark` совпадают и не пересекаются с `variables`; удалить тест «gives the first avatar a lighter tint in dark»; `dark["--mantine-color-default-hover"] !== colors.dark[6]`
- [x] тест контраста (хелпер WCAG, ≥ 4.5, обе схемы): text/surface, dimmed/surface, dimmed/feed-bg, dimmed/primary-soft, error/surface, error/field-bg, bubble-in-text/bubble-in-bg, bubble-out-text/bubble-out-bg, bubble-out-meta/bubble-out-bg, bubble-out-meta/bubble-failed-bg, danger-text/bubble-failed-bg, danger-text/surface, primary-soft-text/primary-soft, day-text/day-bg, warning-text/warning-bg, on-primary/primary filled и filled-hover, белый на red-filled, `lavender-4`/surface (ссылка в dark), пять пар аватаров
- [x] `make check` — зелёный
- [x] ➕ `--mantine-color-red-filled`/`-filled-hover` → red-8/red-9 в обеих схемах: при `primaryShade.light: 6` red-filled в light — red-6 `#fa5252` (белый — 3.3:1); red-8 даёт 4.51:1

### Task 2: Компоненты Mantine: резолвер вариантов, поля, фокус (M)
**Model:** opus — механизм Mantine, где ошибка не видна в собственных проверках (белый текст на светлом primary, пропавшие рамки ошибок)

**Files:**
- Modify: `src/app/providers/theme.ts`
- Modify: `src/app/providers/theme.test.ts`
- Modify: `src/app/styles/index.css`

- [ ] `variantColorResolver` (Technical Details): `filled` primary → `--ga-on-primary`; вариант `field` для `ActionIcon`; остальное — `defaultVariantColorsResolver`
- [ ] `theme.components`: `ActionIcon` — radius 12; `Input` — `variant: "filled"` + `--input-bg: var(--ga-field-bg)` (не `--input-bd`); `Button`, `Popover`, `Notification` — радиусы из «Размеров»; только `var(...)`
- [ ] `focusClassName` + класс в `index.css` с кольцом из Technical Details (сверить API `focusRing`/`focusClassName` в Mantine 9.6)
- [ ] тесты: `fullTheme.variantColorResolver({ color: "lavender", variant: "filled", theme })` и без `color` → `color` = `var(--ga-on-primary)`; `color: "red"`, `filled` → белый текст (как дефолт); вариант `field` → фон `var(--ga-field-bg)`
- [ ] тест: `TextInput` с `error` рендерит `data-error` и сообщение; рендер `ActionIcon variant="field"` не падает (через `@test/render` с темой — если `render` тему не получает, обернуть в `MantineProvider theme={theme}` в тесте)
- [ ] `make check` — зелёный

### Task 3: Иконки stroke 1.8 и недостающие (S)
**Model:** sonnet — пути по Lucide, API экспорта сохраняется, тест ловит ошибки

**Files:**
- Modify: `src/shared/ui/icons.tsx`
- Modify: `src/shared/ui/icons.test.tsx`
- Modify: `src/shared/ui/index.ts`

- [ ] `strokeWidth` 1.8 в `Icon`; пути существующих иконок сверить с Lucide (`arrow-left`, `trash-2`, `plus`, `log-out`, `clock`, `check`, `check-check`)
- [ ] добавить `IconSearch`, `IconMessageCircle`, `IconArrowUp`, `IconArrowRight`, `IconRotateCcw`, `IconWifi` (пути Lucide, лицензия ISC — комментарий-ссылка в файле)
- [ ] экспорт новых иконок из `index.ts`; `IconLogo`, `IconSend`, `IconAlert` пока остаются (удаление — задача 8)
- [ ] тесты: новые иконки рендерят `svg` с `aria-hidden`, `stroke-width="1.8"`, `size` задаёт ширину/высоту
- [ ] `make check` — зелёный

### Task 4: Каркас и сайдбар, форма нового чата (M)
**Model:** sonnet — раскладка и разметка заданы планом, поведение фокуса покрыто тестами

**Files:**
- Modify: `src/pages/chat/ui/chat-page.module.css`
- Modify: `src/pages/chat/ui/chat-page.tsx` (если нужна обёртка карточек)
- Modify: `src/pages/chat/ui/chat-page.test.tsx`
- Modify: `src/pages/chat/ui/sidebar.tsx`
- Modify: `src/pages/chat/ui/sidebar.module.css`
- Modify: `src/pages/chat/ui/sidebar.test.tsx`
- Modify: `src/pages/chat/ui/create-chat-form.tsx`
- Modify: `src/pages/chat/ui/create-chat-form.test.tsx`
- Modify: `src/features/auth/ui/logout-button.tsx`

- [ ] каркас: фон app-bg, `padding`/`gap` 12, карточки сайдбара и окна — surface, радиус 22, `overflow: hidden`; `< $mantine-breakpoint-sm` — без отступа и радиуса; переключение список ↔ чат по `data-view` не трогать
- [ ] шапка сайдбара: `IconMessageCircle` в soft-квадрате (primary-soft / primary-soft-text, 36/12), `h1` «Чаты» 18/650 (`Title order={1}`, вместо `AppTitle`); «+» — `ActionIcon` 38/12, `variant={open ? "light" : "filled"}` (видимое состояние `aria-expanded`; атрибуты и логика без изменений); выход — `ActionIcon variant="field"` с `IconLogout`
- [ ] форма нового чата: поле в стиле поиска (`IconSearch` в `leftSection`, фон из темы), плейсхолдер «+7 999 123-45-67» и `aria-label` без изменений; справа — primary `ActionIcon type="submit"` 38/12 с `IconArrowRight`, `aria-label="Создать"`, `loading` в ожидании; ошибка — через `--mantine-color-error` (задача 1)
- [ ] тесты: `sidebar.test.tsx` и `chat-page.test.tsx:25` — `h1` «Чаты»; «+» и «Выйти» по имени; тесты фокуса/Escape без изменений логики
- [ ] тест формы: кнопка по имени «Создать», в ожидании `disabled`/`data-loading`, сабмит и ошибка — как раньше
- [ ] `make check` — зелёный

### Task 5: Список чатов и аватары (S)
**Model:** sonnet — стили и параметры аватара заданы, хеш не меняется

**Files:**
- Modify: `src/pages/chat/ui/chat-list.module.css`
- Modify: `src/pages/chat/ui/chat-avatar.tsx`
- Modify: `src/pages/chat/ui/chat-avatar.test.tsx`
- Modify: `src/pages/chat/ui/chat-list.test.tsx`

- [ ] строки: радиус 16, отступы по макету, hover — field-bg; активная — фон primary-soft без смены цвета текста и без полосы; время активной — primary-soft-text, неактивной — dimmed; имя 15/600, превью 13.5 dimmed; фокус — внутреннее кольцо (`inset 0 0 0 2px var(--mantine-primary-color-filled)`)
- [ ] аватар: проп `radius` (по умолчанию 16) и `size` (по умолчанию 46); `variant="filled"` + `vars` пастельных пар; `autoContrast` не используется; хеш `colorFor` не менять
- [ ] тест аватара: один `chatId` — одна пара с инициалами и без; разные `chatId` — разные пары (как сейчас); `radius` доходит до `--avatar-radius`
- [ ] тест списка: активная строка — `aria-current="true"`, остальное без изменений
- [ ] `make check` — зелёный

### Task 6: Окно чата — шапка, пузыри, статусы, плашка дня (M)
**Model:** sonnet — вид статусов и цвета заданы планом, роли покрыты тестами

**Files:**
- Modify: `src/pages/chat/ui/chat-window.tsx`
- Modify: `src/pages/chat/ui/chat-window.module.css`
- Modify: `src/pages/chat/ui/chat-window.test.tsx`
- Modify: `src/pages/chat/ui/message-bubble.tsx`
- Modify: `src/pages/chat/ui/message-bubble.module.css`
- Modify: `src/pages/chat/ui/message-bubble.test.tsx`
- Modify: `src/pages/chat/ui/empty-state.tsx`
- Modify: `src/pages/chat/ui/empty-state.module.css`
- Modify: `src/features/delete-chats/ui/delete-chat-button.tsx`
- Modify: `src/features/delete-chats/ui/delete-chat-button.test.tsx`

- [ ] шапка: surface, нижняя граница `--ga-border`, аватар 42 / radius 14, имя 16/650 (`Title order={2}` остаётся); «Назад» и удаление — `ActionIcon variant="field"` 38/12; `DeleteChatButton` нейтральная, красная — только «Удалить» в поповере
- [ ] лента — feed-bg; плашка дня — pill day-bg / day-text, радиус 999; пустые состояния — `IconMessageCircle` вместо `IconLogo`, dimmed
- [ ] пузыри: радиус 20 с хвостом 6; входящие — bubble-in-bg + рамка `--ga-border`; исходящие — bubble-out-bg / bubble-out-text; мета без `opacity` (цвет `-meta`), 11.5–12; без теней
- [ ] статусы: `sending` — `IconClock`, `sent` — `IconCheck`, `delivered` — `IconChecks` цвета меты, `read` — `IconChecks` `--ga-status-read`; `role="img"` + `aria-label` без изменений
- [ ] failed: фон bubble-failed-bg, мета bubble-out-meta, видимый текст «Не отправлено» (`--ga-danger-text`, вместо `IconAlert` с `role="img"`) + pill «Повторить» (surface-фон, `--ga-danger-text`, `IconRotateCcw`, радиус 999)
- [ ] тесты пузыря (`message-bubble.test.tsx:72,104`): «Не отправлено» — `getByText`; статусы — по `role="img"` и имени; «Повторить» вызывает повтор; устаревший `sending` показывается как failed
- [ ] `chat-window.test.tsx:186`: `queryByText("Не отправлено")` вместо `queryByRole("img", …)` (иначе проверка пустая); тест кнопки удаления — имя и подтверждение без изменений
- [ ] `make check` — зелёный

### Task 7: Композер-«пилюля» (S)
**Model:** sonnet — стили заданы, поведение Enter/отправки покрыто тестами

**Files:**
- Modify: `src/pages/chat/ui/composer.tsx`
- Modify: `src/pages/chat/ui/composer.module.css`
- Modify: `src/pages/chat/ui/composer.test.tsx`

- [ ] зона композера — feed-bg; форма — «пилюля» surface, радиус 18, тень `0 2px 10px var(--ga-composer-shadow)` + ring 1px `--ga-border`; на `:focus-within` — кольцо фокуса
- [ ] поле `variant="unstyled"`, плейсхолдер «Напишите сообщение…» (`aria-label="Сообщение"` не меняется)
- [ ] кнопка отправки 40/14 `filled` с `IconArrowUp`; disabled — field-bg + иконка `--mantine-color-placeholder`
- [ ] тесты: «Отправить» disabled на пустом черновике, отправка по Enter и кнопкой — как раньше
- [ ] `make check` — зелёный

### Task 8: Логин, индикатор соединения, удаление старых иконок (S)
**Model:** sonnet — рестайл по заданным токенам, тексты и роли покрыты тестами

**Files:**
- Modify: `src/pages/login/ui/login-page.tsx`
- Modify: `src/pages/login/ui/login-page.module.css`
- Modify: `src/pages/login/ui/login-page.test.tsx`
- Modify: `src/features/auth/ui/login-form.tsx`
- Modify: `src/features/receive-messages/ui/connection-indicator.tsx`
- Modify: `src/features/receive-messages/ui/connection-indicator.module.css`
- Modify: `src/features/receive-messages/ui/connection-indicator.test.tsx`
- Modify: `src/app/app.test.tsx`
- Modify: `src/pages/chat/ui/chat-page.module.css` (место индикатора)
- Modify: `src/shared/ui/icons.tsx`, `src/shared/ui/icons.test.tsx`, `src/shared/ui/index.ts`

- [ ] логин: страница app-bg; карточка surface, радиус 22, без тени и рамки; логотип — `IconMessageCircle` в soft-квадрате; `AppTitle` (бренд) остаётся `h1`; поля и «Войти» — из темы
- [ ] индикатор: pill warning-bg / warning-text, радиус 999, `IconWifi` вместо `Loader` + «Переподключение…», `role="status"`; место — по центру над карточками в отступе `.root` (на узком экране — полоса на всю ширину); только при `reconnecting`
- [ ] проверить вид тостов и поповера удаления в обеих схемах (темой из задачи 2); если чего-то не хватает — дополнить `theme.components` и отметить ➕ в плане
- [ ] удалить `IconLogo`, `IconSend`, `IconAlert` (grep — потребителей нет) из `icons.tsx`, `index.ts`, тестов
- [ ] тесты: `connection-indicator.test.tsx` (статус через `receiveStatusAtom` внутри слайса — как сейчас) — текст «Переподключение…»; `app.test.tsx:353` — новый текст; логин — `h1` «GREEN-API chat» на месте
- [ ] `make check` — зелёный

### Task 9: Чистка токенов и хардкода (S)
**Model:** sonnet — механическая чистка, grep и тесты ловят промахи

**Files:**
- Modify: `src/app/providers/theme.ts`
- Modify: `src/app/providers/theme.test.ts`
- Modify: `src/**/*.module.css` (по результатам grep)

- [ ] grep `var(--ga-` по `src/**/*.css` и `theme.ts`: удалить токены без читателей (список в Technical Details), каждый прочитанный токен определён в обеих схемах
- [ ] grep `#[0-9a-fA-F]{3,8}\b|rgba?\(` по `src/**/*.css` — цветов нет, кроме `src/app/styles/index.css` (дубли с комментарием)
- [ ] grep `color="red"|color="gray"` в `.tsx` — убрать остатки, расходящиеся с макетом («Удалить» в поповере остаётся красной)
- [ ] тест темы: у каждого `--ga-*` — значение-цвет (регэксп), список ключей обновлён
- [ ] `make check` — зелёный

### Task 10: Verify acceptance criteria
**Model:** sonnet — checks the result against the plan, fixes gaps

- [ ] обе схемы соответствуют макету 5a (цвета, радиусы, иконки) — `make dev`, светлая и тёмная, 1280px и 375px
- [ ] контраст текста ≥ 4.5:1 (тест темы + DevTools на отрисованных кнопках: primary в dark — тёмный текст, «Удалить» в dark читается)
- [ ] хардкода цветов вне `theme.ts` и дублей (`index.css`, `index.html`, `favicon.svg`) нет
- [ ] клавиатура: Tab по сайдбару, списку, шапке, композеру — кольца видны и не обрезаны; `aria-label` у всех `ActionIcon`
- [ ] мобильная раскладка: список ↔ чат, «Назад», фокус по правилам AGENTS.md
- [ ] `make check` — зелёный; `make build` без предупреждений CSS

### Task 11: [Final] Update documentation
**Model:** sonnet — docs describe built behavior

- [ ] `AGENTS.md`, «Стили»: палитра 5a (`lavender`, `primaryShade`, override `lavender-filled` в dark, dark-шкала), `variantColorResolver` (`--ga-on-primary`, вариант `field`), `Input` `filled`, `focusClassName`, новый список токенов, карточки, радиусы, иконки stroke 1.8; `h1` «Чаты» в `ChatPage`, `AppTitle` — только логин; индикатор «Переподключение…»
- [ ] `README.md:25-27` (индикатор), `:169-171` (палитра №4705) — новая палитра и текст индикатора
- [ ] `docs/plans/20260923-telegram-chat-design.md:130,158,180,404,504,531-533` — палитра и «Переподключение…»
- [ ] переместить план в `docs/plans/completed/`

## Post-Completion

*Требуют ручного участия, без чекбоксов*

**Ручная проверка:**
- сверка с `docs/design/pastel-5a/pastel-5a-reference.png` на реальных данных (длинные имена, длинные сообщения, много чатов);
- Safari (iOS и macOS) — `:focus-visible`, `100dvh`, тень композера;
- деплой Vercel: CSP не нарушается (новых внешних ресурсов нет), `theme-color` в адресной строке мобильного браузера.

**Решения на будущее:**
- scope B — отдельный этап по таблице оценки (кандидаты: фильтр списка, бейдж непрочитанных).
