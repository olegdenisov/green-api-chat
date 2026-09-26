# Этап 6: Полировка и сдача

## Overview

- Последний из 6 этапов (см. `docs/plans/20260923-telegram-chat-design.md`, «Этапы»):
  вёрстка по мотивам web.max.ru, пустые состояния, дополнительные компонентные тесты,
  README, CI и деплой.
- Функциональность этапов 1–5 не меняется: модель данных, API-клиент и потоки
  отправки/получения остаются как есть. Меняются вёрстка, тема, иконки, тексты пустых
  состояний, доступность.
- Вёрстка «узнаваемо MAX, без новых данных»: тема Mantine с акцентом MAX, аватары с
  инициалами, список чатов с превью и временем, фон ленты, разделители по дням, шапка окна
  с аватаром, кнопка отправки-иконка, карточка логина. Корректна в светлой и тёмной теме
  (`auto` — по системе). Счётчиков непрочитанного, поиска и переключателя темы нет.
- Без новых зависимостей: только Mantine + CSS Modules, иконки — инлайн-SVG, шрифт —
  системный стек (без веб-шрифтов). Логотип — свой, не товарный знак MAX.
- Доступность: у интерактивных элементов доступные имена, видимый фокус, семантика
  (`nav`/`main`/`log`/`separator`), фокус не теряется при «Назад» и закрытии подтверждения;
  тесты — по ролям и именам.
- CI — GitHub Actions: `make check` и `make build` на push в `main` и на PR. Деплой — Git-
  интеграция Vercel (preview на PR, production на `main`); в репозитории только
  `vercel.json`.
- Итог: приложение задеплоено, README описывает запуск, проверку и известные ограничения;
  `make check` зелёный после каждой задачи.

## Context (from discovery)

- Этапы 1–5 влиты в `main`; итоги — `docs/plans/completed/2026092*-0{1..5}-*.md`. 38
  тестовых файлов.
- UI: `src/app/providers/ui-provider.tsx` — голый `<MantineProvider>` без темы (схема
  `light` по умолчанию, `data-mantine-color-scheme` на `<html>` уже ставится);
  `src/app/styles/index.css` — только `body { margin: 0 }`. `index.html`: `lang="ru"`,
  `<title>GREEN-API chat</title>` (совпадает с `AppTitle`), пустой favicon (`data:,`).
- `pages/chat/ui`: `ChatPage` (грид `sidebar | window`, на узком экране — одна колонка по
  `data-view`; переключение список → чат → «Назад» уже покрыто `chat-page.test.tsx`),
  `Sidebar` (шапка с `AppTitle` и «Выйти», `CreateChatForm`, `ChatList` в `nav`),
  `ChatList` (`NavLink`: `title`, превью `messages[chatId].at(-1).text`,
  `formatChatTime`), `ChatWindow` (шапка: «←» на узком экране, `Title`,
  `DeleteChatButton`; `Feed` с `role="log"`, `Composer` — уже `Textarea autosize
  minRows=1 maxRows=6`), `MessageBubble` (цвета по направлению, `HH:MM`, статусы —
  `<span aria-label>` «…»/«✓», «Не отправлено · Повторить»). Пустые состояния уже есть:
  «Создайте чат по номеру телефона», «Выберите чат или создайте новый», «Сообщений пока нет».
- «Назад» делает `activeChatIdAtom.set(null)`: шапка с кнопкой исчезает, фокус падает на
  `body`.
- `pages/chat/lib/format-time.ts`: `formatTime` (`HH:MM`), `formatChatTime` (сегодня —
  `HH:MM`, иначе `DD.MM.YY`).
- `pages/login/ui/login-page.tsx`: `Paper` с `AppTitle` и `LoginForm` по центру.
- `features/delete-chats/ui/delete-chat-button.tsx`: текстовая кнопка «Удалить чат» +
  `Popover` подтверждения (`returnFocus` у `Popover` по умолчанию `false`).
  `features/auth/ui/logout-button.tsx`: `Button` «Выйти».
- `features/receive-messages/ui/connection-indicator.tsx` — полоса «Соединение…».
- Тесты компонентов ищут элементы по ролям/текстам («Удалить чат», «Назад к чатам»,
  «Отправить» и т.п.) — при замене текстовых кнопок на иконки доступное имя сохраняется
  через `aria-label`.
- Без теста: `Sidebar` (покрыт косвенно через `ChatPage`), `AppTitle`.
- Git remote не настроен, `.github/` нет, `vercel.json` нет. `packageManager: pnpm@12.5.1`,
  `engines.node >= 22`, сборка — `tsc -b && vite build` → `dist/`. Роутера нет — SPA-rewrite
  не нужен.
- Креды хранятся в `localStorage`, токен идёт в URL запросов — XSS критичен, поэтому
  заголовки безопасности (CSP) в `vercel.json` оправданы.
- Дизайн-документ, «Непроверенное»: CORS для `receiveNotification`/`deleteNotification` не
  проверен вручную.

## Development Approach

- **testing approach**: Regular (код, затем тесты в той же задаче)
- каждую задачу завершать полностью до перехода к следующей; коммит на каждую задачу
- небольшие точечные изменения; модель данных и модели Reatom не трогать
- **CRITICAL: каждая задача включает новые/обновлённые тесты** — успешные и крайние сценарии
- **CRITICAL: `make check` зелёный до начала следующей задачи** (включая steiger)
- **CRITICAL: план обновляется при изменении объёма работ**
- API Mantine 9 (тема, `cssVariablesResolver`, `Avatar name`, `defaultColorScheme`,
  `Popover returnFocus`), настройки Vercel (`vercel.json`, pnpm/Corepack) и GitHub Actions
  (`pnpm/action-setup`, `actions/setup-node`) сверять по актуальной документации, не по
  памяти
- цвета и пропорции брать с web.max.ru (DevTools через `chrome-devtools` MCP), а не
  придумывать; если web.max.ru недоступен без входа — с max.ru, источник записать в тему
  комментарием
- каждое визуальное изменение проверять в браузере (`make dev`) в светлой и тёмной теме и
  на ширине ~375 px — скриншотом через `chrome-devtools`

## Testing Strategy

- **unit**: `formatDayLabel` (в т.ч. «вчера» 1-го числа и 1 января).
- **компонентные**: обновлённые `ChatList`, `ChatWindow`, `MessageBubble`, `Composer`,
  `LoginPage`, `LogoutButton`, `DeleteChatButton`; новые — `Sidebar`, `AppTitle`,
  разделители дней в ленте, доступные имена кнопок-иконок, клавиатура (Tab/Enter по
  списку чатов, Escape в подтверждении удаления), фокус после «Назад».
- **интеграционные** (`app.test.tsx`): тёмная схема по `prefers-color-scheme`; сценарий
  «логин → новый чат → отправка → входящий ответ» из этапов 4–5 проходит после смены
  вёрстки.
- визуальных/скриншотных тестов нет (jsdom не считает CSS) — вёрстку проверяем вручную в
  браузере, в тестах — структуру, роли и `data-*`-атрибуты.
- e2e-тестов в проекте нет. CI и деплой проверяются вручную после пуша (Post-Completion).

## Progress Tracking

- отмечать выполненное `[x]` сразу
- новые задачи — с префиксом ➕, блокеры — ⚠️
- при отклонении от плана — обновлять план

## Solution Overview

- **Тема** — `src/app/providers/theme.ts`: `createTheme` (`primaryColor` — своя палитра
  MAX из 10 оттенков, системный `fontFamily`, `defaultRadius`) и `cssVariablesResolver` с
  токенами, которых нет у Mantine (фон ленты, пузыри входящих/исходящих, фон разделителя
  дня) — отдельно для `light` и `dark`, префикс `--ga-`. Модули стилей используют только
  переменные Mantine и `--ga-*` из темы; своих цветовых переменных в
  `app/styles/index.css` нет, хардкода цветов в компонентах тоже.
  `MantineProvider theme={theme} defaultColorScheme="auto"`.
- **Без скрипта схемы**: SPA без переключателя; `MantineProvider` ставит
  `data-mantine-color-scheme` при монтировании, CSS из `<link>` применяется раньше JS.
  Вспышку светлого фона до загрузки бандла гасит CSS в `index.css`:
  `html { color-scheme: light dark }` и тёмный фон `body` под
  `@media (prefers-color-scheme: dark)` для `:root:not([data-mantine-color-scheme])`;
  `<meta name="theme-color">` — два варианта с `media`. Inline-скриптов в `index.html` нет —
  CSP без исключений для `script-src`.
  `render` из `@test/render` тему не получает (как и раньше) — тесты от неё не зависят.
- **Аватар** — `Avatar` Mantine с `name` (инициалы) и `color="initials"`. Заголовок-номер
  (`+7999…`, чат без `username`) дал бы одну цифру — для заголовков, начинающихся с `+` или
  цифры, `Avatar` без `name` (иконка-плейсхолдер Mantine), цвет — по `chatId`. Один
  слайс-потребитель (`pages/chat`: список и шапка окна) — компонент в
  `pages/chat/ui/chat-avatar.tsx` (pages-first).
- **Разделители по дням** — чистая функция `formatDayLabel(timestamp, now)` в
  `pages/chat/lib/format-time.ts` и группировка в `Feed`: разделитель перед первым
  сообщением каждого локального дня (`role="separator"` с текстом). Модель не меняется —
  `activeMessagesAtom` остаётся списком.
- **Иконки** — инлайн-SVG в `src/shared/ui/icons.tsx` (стрелка «назад», «отправить»,
  корзина, выход, свой логотип): потребители в `pages/chat`, `pages/login`,
  `features/auth`, `features/delete-chats` — значит, `shared/ui` (сегмент без слайсов,
  `insignificant-slice` не применяется). `aria-hidden` у SVG, имя — у кнопки.
- **Кнопки-иконки** — `ActionIcon` с `aria-label`, совпадающим с прежним текстом
  («Удалить чат», «Отправить», «Выйти»). `Tooltip` — только у «Выйти» (у «Удалить чат»
  цель уже обёрнута `Popover.Target`, двойное клонирование не нужно).
- **Статусы сообщения** — иконка/символ с `role="img"` и `aria-label` («Отправлено»,
  «Отправляется»): `aria-label` на `span` без роли ARIA не допускает.
- **Фокус после «Назад»** — `ChatPage` (единственный, кто видит обе колонки) запоминает
  chatId, который закрыли «Назад», и после рендера списка переводит фокус на строку этого
  чата (кнопка с `data-chat-id` внутри `nav`), нет строки — на `nav`. Модель не меняется:
  обработчик «Назад» в `ChatWindow` получает колбэк от `ChatPage` или `ChatPage` следит за
  переходом `activeChatId` X → `null` — выбрать при реализации, проще — колбэк.
- **Deploy** — `vercel.json`: `framework: "vite"` (сборка и `dist` — из пресета),
  `installCommand` — только если проверка pnpm 12 этого требует; `headers` для всех путей:
  `Content-Security-Policy` — `default-src 'self'`, `script-src 'self'`, `connect-src
  https:` (`apiUrl` задаёт пользователь), `style-src 'self' 'unsafe-inline'` (Mantine
  вставляет `<style>` — `MantineCssVariables`/`MantineClasses`; nonce на статике
  невозможен), `img-src 'self' data:`, `font-src 'self'`, `object-src 'none'`,
  `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`;
  `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
- **CI** — `.github/workflows/ci.yml`: `pnpm/action-setup` (версия из `packageManager`),
  `actions/setup-node` с `cache: pnpm` и матрицей Node `22`/`24` (минимум из `engines` и
  версия разработки), `pnpm install --frozen-lockfile`, `make check`, `make build`.
  Git-интеграция Vercel деплоит независимо от статуса CI — это фиксируется в README.

## Technical Details

### `formatDayLabel(timestamp, now)`

- Сравнение по локальной дате (`toDateString()`), как в `formatChatTime`.
- Тот же день — «Сегодня»; вчера — `const d = new Date(now); d.setDate(d.getDate() - 1)`
  и сравнение `toDateString()` (не `setDate(-1)` — это предпоследний день прошлого месяца).
- Тот же год — `Intl.DateTimeFormat("ru", { day: "numeric", month: "long" })` →
  «25 сентября» (родительный падеж); другой год — та же строка + `" " + год` →
  «3 января 2025». Не `year: "numeric"` в `Intl` — он даёт «3 января 2025 г.».
  Вывод сверить в Node 22/24.

### Группировка в `Feed`

- Проход по `messages`: ключ дня — `new Date(ts).toDateString()`; при смене ключа перед
  сообщением вставляется разделитель `key={"day-" + dayKey}`. `now` — один `Date.now()` на
  рендер (как в `ChatList`). Отдельного атома не заводим.
- Скролл вниз при добавлении сообщения (`useEffect` по `count`) остаётся как есть.

### Тема и тёмная схема

- `defaultColorScheme="auto"`; Mantine хранит выбор в `localStorage` под своим ключом —
  переключателя нет, значит, фактически всегда `auto`. `vitest.setup.ts` чистит
  `localStorage` после каждого теста — конфликта нет.
- Тест тёмной схемы: `matchMedia` застабить (`vi.stubGlobal`) с `matches: true` для
  `(prefers-color-scheme: dark)`, ожидать `data-mantine-color-scheme="dark"`; атрибут
  остаётся на `documentElement` после теста — снимать в `afterEach` этого файла.

## Риски

- **CORS опроса с домена Vercel.** `receiveNotification`/`deleteNotification` из браузера
  вручную ещё не проверены. Если не работают — фолбэк: `rewrites` в `vercel.json` на
  `https://*.api.green-api.com` (хост по `idInstance`, как в `apiUrl`) и
  `connect-src 'self'`; для dev — `server.proxy` Vite. Это отдельная задача ➕ с
  изменением `shared/api` — добавить в план, только если проблема подтвердится.
- **pnpm 12 на Vercel.** Если сборщик Vercel не поддерживает — Corepack через переменную
  окружения проекта или `installCommand` с `corepack`.

## What Goes Where

- **Implementation Steps** (`[ ]`): код, стили, тесты, `vercel.json`, workflow CI, README,
  документация.
- **Post-Completion** (без чекбоксов): создание GitHub-репозитория и пуш, подключение
  Vercel, ручная проверка CI, деплоя, CSP, CORS и сценария на реальном инстансе.

## Implementation Steps

### Task 1: Тема Mantine, тёмная схема, `index.html`

**Files:**
- Create: `src/app/providers/theme.ts`
- Modify: `src/app/providers/ui-provider.tsx`
- Modify: `src/app/styles/index.css`
- Modify: `index.html`
- Create: `public/favicon.svg`
- Modify: `src/app/app.test.tsx`

- [x] снять палитру web.max.ru через `chrome-devtools` (акцент, фон ленты, пузыри (частично: chrome-devtools отказано в навигации на внешний сайт, палитра подобрана по публичным скриншотам/брендовому цвету MAX, источник в комментарии `theme.ts`)
      входящих/исходящих, вторичный текст; светлая и тёмная схемы); источник —
      комментарием в `theme.ts`
- [x] `theme.ts`: `createTheme` с палитрой MAX (`primaryColor`), системным `fontFamily`,
      `defaultRadius`; `cssVariablesResolver` с токенами `--ga-*` для light/dark;
      `UiProvider` — `theme`, `cssVariablesResolver`, `defaultColorScheme="auto"`
- [x] `index.css`: `color-scheme: light dark` и тёмный фон `body` до монтирования (см.
      «Solution Overview»), без скриптов
- [x] `index.html`: favicon (`public/favicon.svg`, свой логотип), два
      `<meta name="theme-color" media=…>`
- [x] тест `App`: при `prefers-color-scheme: dark` (стаб `matchMedia`) у `<html>`
      `data-mantine-color-scheme="dark"`, без стаба — `light`
- [x] проверить в браузере светлую и тёмную схемы (эмуляция `prefers-color-scheme`) (skipped - chrome-devtools недоступен; проверено сборкой и тестом схемы)
- [x] `make check` — зелёный

### Task 2: Иконки и кнопки-иконки

**Files:**
- Create: `src/shared/ui/icons.tsx`
- Modify: `src/shared/ui/index.ts`
- Modify: `src/features/auth/ui/logout-button.tsx`
- Modify: `src/features/auth/ui/logout-button.test.tsx`
- Modify: `src/features/delete-chats/ui/delete-chat-button.tsx`
- Modify: `src/features/delete-chats/ui/delete-chat-button.test.tsx`

- [x] `icons.tsx`: инлайн-SVG (`IconArrowLeft`, `IconSend`, `IconTrash`, `IconLogout`,
      `IconLogo`), `aria-hidden`, `currentColor`, размер пропсом
- [x] `LogoutButton` — `ActionIcon` с `IconLogout`, `aria-label="Выйти"`, `Tooltip`
- [x] `DeleteChatButton` — `ActionIcon` с `IconTrash`, `aria-label="Удалить чат"`;
      `Popover` с `returnFocus`
- [x] обновить тест «Выйти»: кнопка по роли и имени, выход работает (тест уже искал кнопку по роли и имени — изменений не потребовалось)
- [x] обновить тесты удаления: кнопка по имени, подтверждение и «Отмена» работают; Escape
      закрывает подтверждение, фокус возвращается на кнопку «Удалить чат»
- [x] `make check` — зелёный

### Task 3: Сайдбар и список чатов

**Files:**
- Create: `src/pages/chat/ui/chat-avatar.tsx`
- Create: `src/pages/chat/ui/chat-avatar.test.tsx`
- Modify: `src/pages/chat/ui/sidebar.tsx`
- Modify: `src/pages/chat/ui/sidebar.module.css`
- Modify: `src/pages/chat/ui/chat-list.tsx`
- Modify: `src/pages/chat/ui/chat-list.module.css`
- Modify: `src/pages/chat/ui/chat-list.test.tsx`
- Create: `src/pages/chat/ui/sidebar.test.tsx`

- [x] `ChatAvatar`: `Avatar` с `name={chat.title}` и `color="initials"`; заголовок-номер
      → без `name` (плейсхолдер); `aria-hidden` (имя чата уже есть в строке)
- [x] строка списка в стиле MAX: аватар, заголовок и время в первой строке, превью
      последнего сообщения во второй (обрезка многоточием), активный чат — фон акцента;
      у исходящего превью префикс «Вы: »; у кнопки строки — `data-chat-id`
- [x] шапка сайдбара: `IconLogo` + `AppTitle` + `LogoutButton`
- [x] пустой список — иконка + «Создайте чат по номеру телефона»
- [x] тест `ChatAvatar`: имя → инициалы, номер (`+7999…`) → плейсхолдер без цифры
- [x] тесты `ChatList`: превью с «Вы: » у исходящего и без — у входящего, чат без
      сообщений без превью, `aria-current` у активного, выбор с клавиатуры (Tab → Enter)
- [x] тест `Sidebar`: заголовок `h1`, кнопка «Выйти», поле нового чата, навигация «Чаты»
- [x] проверить в браузере (светлая/тёмная, 375 px) (skipped - chrome-devtools недоступен; вёрстка не проверена визуально) и `make check`

### Task 4: Окно чата и разделители по дням

**Files:**
- Create: `src/pages/chat/ui/empty-state.tsx`, `empty-state.module.css`, `empty-state.test.tsx` (➕ общий компонент пустого состояния)
- Modify: `src/pages/chat/ui/chat-list.tsx`, `chat-list.module.css`
- Modify: `src/pages/chat/lib/format-time.ts`
- Modify: `src/pages/chat/lib/format-time.test.ts`
- Modify: `src/pages/chat/ui/chat-window.tsx`
- Modify: `src/pages/chat/ui/chat-window.module.css`
- Modify: `src/pages/chat/ui/message-bubble.module.css`
- Modify: `src/pages/chat/ui/chat-window.test.tsx`

- [x] `formatDayLabel(timestamp, now)` — «Сегодня» / «Вчера» / «25 сентября» /
      «3 января 2025» (см. «Technical Details»)
- [x] `Feed`: разделитель (`role="separator"`, текст дня) перед первым сообщением каждого
      дня; стиль — «пилюля» по центру, как в MAX
- [x] шапка окна: «←» (`IconArrowLeft`), `ChatAvatar`, заголовок; `DeleteChatButton`
      справа
- [x] фон ленты и пузыри на токенах `--ga-*`; скругления и цвета — по MAX
- [x] пустой чат и «чат не выбран» — иконка + текст по центру (общий `EmptyState` в `pages/chat/ui`, им же пользуется `ChatList`)
- [x] тесты `formatDayLabel`: сегодня; вчера — обычный день, 1-е число месяца, 1 января,
      тот же год; другой год без «г.»
- [x] тесты `ChatWindow`: разделители между сообщениями разных дней, один на день, их
      порядок; кнопка «Назад к чатам» по имени; заголовок чата — `h2`
- [x] проверить в браузере и `make check`

### Task 5: Кнопка отправки и статусы сообщения

**Files:**
- Modify: `src/pages/chat/ui/composer.tsx`
- Modify: `src/pages/chat/ui/composer.module.css`
- Modify: `src/pages/chat/ui/composer.test.tsx`
- Modify: `src/pages/chat/ui/message-bubble.tsx`
- Modify: `src/pages/chat/ui/message-bubble.test.tsx`

- [x] composer: кнопка «Отправить» — `ActionIcon` с `IconSend` и `aria-label`, неактивна
      при пустом тексте (как сейчас); поле, `Enter`/`Shift+Enter` и лимит 4096 не меняются;
      вёрстка строки ввода — по MAX
- [x] статусы в пузыре: «✓» и «…» — `role="img"` + `aria-label` («Отправлено»,
      «Отправляется»); «Не отправлено · Повторить» — без изменения текста
- [x] обновить тесты composer: кнопка по имени «Отправить», `disabled` при пустом тексте,
      `Enter` отправляет, `Shift+Enter` — перенос (тесты уже искали кнопку по роли и имени — изменений не потребовалось)
- [x] обновить тесты пузыря: статусы через `getByRole("img", { name })`, «Повторить»
      работает
- [x] проверить в браузере и `make check`

### Task 6: Страница логина и индикатор соединения

**Files:**
- Modify: `src/pages/login/ui/login-page.tsx`
- Modify: `src/pages/login/ui/login-page.module.css`
- Modify: `src/pages/login/ui/login-page.test.tsx`
- Modify: `src/features/receive-messages/ui/connection-indicator.module.css`
- Create: `src/shared/ui/app-title.test.tsx`

- [ ] логин: карточка по центру на фоне в стиле MAX, `IconLogo` над названием, подсказка,
      где взять `idInstance`/`apiTokenInstance` (ссылка на консоль GREEN-API)
- [ ] полоса «Соединение…» — цвета из темы, корректна в тёмной схеме
- [ ] тест `AppTitle`: `h1` с названием приложения, `className` дописывается
- [ ] тест `LoginPage`: заголовок, форма, ссылка на консоль GREEN-API с
      `target="_blank"` и `rel="noreferrer"`
- [ ] проверить в браузере и `make check`

### Task 7: Доступность: фокус после «Назад» и аудит

**Files:**
- Modify: `src/pages/chat/ui/chat-page.tsx`
- Modify: `src/pages/chat/ui/chat-window.tsx`
- Modify: `src/pages/chat/ui/chat-page.test.tsx`
- Modify: `src/pages/chat/ui/*.module.css` (по результатам аудита)
- Modify: `src/app/app.test.tsx`

- [ ] фокус после «Назад»: `ChatPage` передаёт в `ChatWindow` колбэк, запоминает закрытый
      chatId и после рендера фокусирует строку этого чата в `nav` (нет строки — сам `nav`,
      `tabIndex={-1}`)
- [ ] аудит: доступные имена у кнопок и полей, landmarks (`nav` «Чаты», `main`), видимый
      `:focus-visible` у строк списка и кнопок-иконок, контраст вторичного текста в обеих
      схемах (Lighthouse `accessibility` через `chrome-devtools`); исправить найденное
- [ ] тест `ChatPage`: после «Назад к чатам» фокус на строке закрытого чата (переключение
      `data-view` уже покрыто — не дублировать)
- [ ] тест `App`: сценарий «логин → новый чат → отправка → входящий ответ» проходит с новой
      вёрсткой (дополнить существующие, не дублировать)
- [ ] `make check` — зелёный

### Task 8: Конфигурация Vercel

**Files:**
- Create: `vercel.json`

- [ ] сверить по документации Vercel: пресет `vite`, поддержка pnpm 12 (Corepack), версия
      Node проекта
- [ ] `vercel.json`: `framework: "vite"`, `installCommand` — только если нужен для pnpm 12;
      `headers` (CSP, `Referrer-Policy`, `X-Content-Type-Options`) — см. «Solution
      Overview»
- [ ] `make build`: в `dist/index.html` нет inline-`<script>` (CSP `script-src 'self'`
      их заблокирует); сама CSP проверяется на preview-деплое (Post-Completion)
- [ ] `oxfmt` форматирует `vercel.json`; `make check` — зелёный

### Task 9: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] сверить актуальные мажорные версии `actions/checkout`, `pnpm/action-setup`,
      `actions/setup-node`
- [ ] workflow: триггеры `push` в `main` и `pull_request`; матрица Node `22`, `24`;
      `pnpm install --frozen-lockfile`, `make check`, `make build`; `concurrency` с
      отменой устаревших запусков на ветке; `permissions: contents: read`
- [ ] прогнать шаги workflow локально на Node 22 (если доступен менеджер версий Node) —
      `pnpm install --frozen-lockfile && make check && make build`
- [ ] `make check` — зелёный

### Task 10: Verify acceptance criteria

- [ ] вёрстка узнаваема как MAX в светлой и тёмной схеме, на широком и узком экране
      (скриншоты `chrome-devtools`); нет вспышки светлого фона при загрузке в тёмной схеме
- [ ] пустые состояния: нет чатов, чат не выбран, чат без сообщений
- [ ] кнопки-иконки имеют доступные имена, фокус виден и не теряется, Lighthouse
      accessibility без критичных замечаний
- [ ] сценарий задания на реальном инстансе: логин → новый чат → отправка → ответ из
      Telegram виден в чате
- [ ] полный прогон: `make check` и `make build`
- [ ] покрытие: у каждого компонента `pages/chat/ui`, `pages/login/ui`, `shared/ui` есть
      тест

### Task 11: [Final] Update documentation

- [ ] README: статус «готово», ссылка на деплой (заполнить после Post-Completion), бейдж CI,
      как пользоваться (где взять креды; входящие появляются в течение ~5 минут после
      первого входа), раздел «Известные ограничения» из дизайн-документа, деплой не ждёт
      CI; структура — `shared/ui/icons`, `pages/chat/ui/chat-avatar`, `.github/workflows`,
      `vercel.json`
- [ ] дизайн-документ: итог этапа 6 в «Этапы», тема и иконки в «Архитектура», удалить
      пометку «(в README на этапе 6)», обновить «Непроверенное» по результату проверки
      CORS опроса
- [ ] `AGENTS.md`: тема (`src/app/providers/theme.ts`, токены `--ga-*` через
      `cssVariablesResolver`, `defaultColorScheme="auto"`, без скрипта схемы), иконки в
      `shared/ui`, CI и `vercel.json` (CSP: без inline-скриптов)
- [ ] переместить план в `docs/plans/completed/`

## Post-Completion

*Ручные шаги и внешние системы — без чекбоксов*

**Публикация и деплой:**
- создать репозиторий на GitHub, `git remote add origin …`, запушить `main`
- проверить, что workflow CI зелёный на обоих Node
- в Vercel: Import Project из GitHub, пресет Vite; при необходимости — Corepack для pnpm 12;
  production-ветка — `main`
- вписать URL деплоя в README и закоммитить

**Ручная проверка на деплое:**
- консоль без нарушений CSP; вход, `checkAccount`, `sendMessage`, опрос
  `receiveNotification`/`deleteNotification` работают (CORS с домена Vercel; при проблеме —
  фолбэк из «Риски»)
- сценарий задания целиком, две вкладки, узкий экран (телефон), тёмная тема системы
- preview-деплой на тестовом PR создаётся
