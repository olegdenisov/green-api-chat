import { Avatar } from "@mantine/core";

import type { Chat } from "@/entities/chat";

const AVATAR_COLOR_COUNT = 5;

/**
 * The name to take initials from: a leading `@` (a Telegram username) and repeated spaces
 * dropped. A title that is empty after that, or starts with a digit or `+` (a phone number),
 * has no useful initials — the avatar then shows a placeholder.
 */
function initialsName(title: string): string | undefined {
  const name = title.replace(/^@+/, "").trim().replace(/\s+/g, " ");
  return name === "" || /^[+\d]/.test(name) ? undefined : name;
}

/**
 * Picks one of the theme's `--ga-avatar-{1..5}-*` token pairs by `chatId`: stable per chat and
 * independent of the title, so an avatar with initials and its placeholder counterpart use the
 * same colour.
 */
function colorFor(chatId: string): number {
  let hash = 0;
  for (const char of chatId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % AVATAR_COLOR_COUNT) + 1;
}

/**
 * Chat picture: initials of the title; for a number or an empty title — Mantine's placeholder
 * icon. The background/foreground colour is picked by `chatId` from the theme's `--ga-avatar-*`
 * tokens (`cssVariablesResolver`), applied through `vars` to Mantine's own `--avatar-bg`/
 * `--avatar-color`. Decorative: the chat name is always next to it.
 */
export function ChatAvatar({
  chat,
  size = 48,
}: {
  chat: Pick<Chat, "chatId" | "title">;
  size?: number;
}) {
  const name = initialsName(chat.title);
  const colorIndex = colorFor(chat.chatId);
  return (
    <Avatar
      aria-hidden="true"
      size={size}
      variant="filled"
      name={name}
      vars={() => ({
        root: {
          "--avatar-bg": `var(--ga-avatar-${colorIndex}-bg)`,
          "--avatar-color": `var(--ga-avatar-${colorIndex}-fg)`,
        },
      })}
    />
  );
}
