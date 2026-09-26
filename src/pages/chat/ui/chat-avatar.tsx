import { Avatar } from "@mantine/core";

import type { Chat } from "@/entities/chat";

const PLACEHOLDER_COLORS = ["blue", "cyan", "grape", "green", "orange", "pink", "teal", "violet"];

/**
 * The name to take initials from: a leading `@` (a Telegram username) and repeated spaces
 * dropped. A title that is empty after that, or starts with a digit or `+` (a phone number),
 * has no useful initials — the avatar then shows a placeholder.
 */
function initialsName(title: string): string | undefined {
  const name = title.replace(/^@+/, "").trim().replace(/\s+/g, " ");
  return name === "" || /^[+\d]/.test(name) ? undefined : name;
}

function colorFor(chatId: string): string {
  let hash = 0;
  for (const char of chatId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length]!;
}

/**
 * Chat picture: initials of the title; for a number or an empty title — Mantine's placeholder
 * icon in a colour picked by `chatId`. Decorative: the chat name is always next to it.
 */
export function ChatAvatar({
  chat,
  size = 48,
}: {
  chat: Pick<Chat, "chatId" | "title">;
  size?: number;
}) {
  const name = initialsName(chat.title);
  return (
    <Avatar
      aria-hidden="true"
      size={size}
      variant="filled"
      autoContrast
      name={name}
      color={name ? "initials" : colorFor(chat.chatId)}
    />
  );
}
