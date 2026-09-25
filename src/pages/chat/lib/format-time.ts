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
