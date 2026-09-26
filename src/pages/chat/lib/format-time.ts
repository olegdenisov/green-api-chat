const pad = (value: number) => String(value).padStart(2, "0");

/** Local `HH:MM`. */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Time in the chat list: `HH:MM` for today, `DD.MM.YY` for other days (local time). */
export function formatChatTime(timestamp: number, now: number): string {
  const date = new Date(timestamp);
  if (date.toDateString() === new Date(now).toDateString()) return formatTime(timestamp);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${pad(date.getFullYear() % 100)}`;
}

const dayMonth = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

/**
 * Day separator label in the feed (local time): «Сегодня», «Вчера», «25 сентября» and, for another
 * year, «3 января 2025» (`Intl` with `year` would add «г.»).
 */
export function formatDayLabel(timestamp: number, now: number): string {
  const date = new Date(timestamp);
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) return "Сегодня";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Вчера";
  const label = dayMonth.format(date);
  return date.getFullYear() === today.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}
