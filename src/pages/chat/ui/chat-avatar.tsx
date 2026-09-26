import { Avatar } from "@mantine/core";

import type { Chat } from "@/entities/chat";

const PLACEHOLDER_COLORS = ["blue", "cyan", "grape", "green", "orange", "pink", "teal", "violet"];

/** A title that is a phone number (`+7999…`) would give one digit as initials. */
function isNumberTitle(title: string): boolean {
  return /^[+\d]/.test(title);
}

function colorFor(chatId: string): string {
  let hash = 0;
  for (const char of chatId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length]!;
}

/**
 * Chat picture: initials of the title; for a number title — Mantine's placeholder icon in a
 * colour picked by `chatId`. Decorative: the chat name is always next to it.
 */
export function ChatAvatar({
  chat,
  size = 48,
  className,
}: {
  chat: Pick<Chat, "chatId" | "title">;
  size?: number;
  className?: string;
}) {
  const named = !isNumberTitle(chat.title);
  return (
    <Avatar
      aria-hidden="true"
      className={className}
      size={size}
      variant="filled"
      autoContrast
      name={named ? chat.title : undefined}
      color={named ? "initials" : colorFor(chat.chatId)}
    />
  );
}
