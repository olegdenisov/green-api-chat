import { ActionIcon, Text, Title } from "@mantine/core";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { useEffect, useRef } from "react";

import { activeChatAtom, activeChatIdAtom } from "@/entities/chat";
import { DeleteChatButton } from "@/features/delete-chats";

import { activeMessagesAtom } from "../model/active-chat";
import { Composer } from "./composer";
import { MessageBubble } from "./message-bubble";

import classes from "./chat-window.module.css";

/**
 * Messages of the active chat; scrolls to the bottom when a message is added. Keyed by the chat,
 * so another chat mounts a new feed and opens at its latest message too.
 */
const Feed = reatomComponent(() => {
  const messages = activeMessagesAtom();
  const feedRef = useRef<HTMLDivElement>(null);
  const count = messages.length;

  useEffect(() => {
    const feed = feedRef.current;
    if (feed && count > 0) feed.scrollTop = feed.scrollHeight;
  }, [count]);

  return (
    <div ref={feedRef} className={classes.feed} role="log" aria-label="Сообщения">
      {count === 0 ? (
        <Text c="dimmed" size="sm" className={classes.placeholder}>
          Сообщений пока нет
        </Text>
      ) : (
        messages.map((message) => <MessageBubble key={message.id} message={message} />)
      )}
    </div>
  );
}, "chat.Feed");

/** Right column: header (back, title, delete), the message feed and the input. */
export const ChatWindow = reatomComponent(({ className }: { className?: string }) => {
  const chat = activeChatAtom();
  const rootClass = `${classes.window} ${className ?? ""}`;

  if (!chat) {
    return (
      <main className={rootClass} data-empty>
        <Text c="dimmed" className={classes.placeholder}>
          Выберите чат или создайте новый
        </Text>
      </main>
    );
  }

  return (
    <main className={rootClass}>
      <header className={classes.header}>
        {/* Only a narrow screen shows one column; there "back" returns to the list. */}
        <ActionIcon
          variant="subtle"
          color="gray"
          hiddenFrom="sm"
          aria-label="Назад к чатам"
          onClick={wrap(() => activeChatIdAtom.set(null))}
        >
          ←
        </ActionIcon>
        <Title order={2} size="h4" className={classes.title}>
          {chat.title}
        </Title>
        <DeleteChatButton chatId={chat.chatId} />
      </header>
      <Feed key={chat.chatId} />
      <Composer />
    </main>
  );
}, "chat.ChatWindow");
