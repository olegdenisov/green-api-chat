import { ActionIcon, Title } from "@mantine/core";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { Fragment, useEffect, useRef } from "react";

import { activeChatAtom, activeChatIdAtom } from "@/entities/chat";
import { DeleteChatButton } from "@/features/delete-chats";
import { IconArrowLeft } from "@/shared/ui";

import { formatDayLabel } from "../lib/format-time";
import { activeMessagesAtom } from "../model/active-messages";
import { ChatAvatar } from "./chat-avatar";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { MessageBubble } from "./message-bubble";

import classes from "./chat-window.module.css";

/**
 * Messages of the active chat with a day separator before the first message of each local day;
 * scrolls to the bottom when a message is added. Keyed by the chat, so another chat mounts a new
 * feed and opens at its latest message too.
 */
const Feed = reatomComponent(() => {
  const messages = activeMessagesAtom();
  const feedRef = useRef<HTMLDivElement>(null);
  const count = messages.length;
  const now = Date.now();
  let lastDay: string | undefined;

  useEffect(() => {
    const feed = feedRef.current;
    if (feed && count > 0) feed.scrollTop = feed.scrollHeight;
  }, [count]);

  return (
    <div ref={feedRef} className={classes.feed} role="log" aria-label="Сообщения">
      {count === 0 ? (
        <EmptyState>Сообщений пока нет</EmptyState>
      ) : (
        messages.map((message) => {
          const day = new Date(message.timestamp).toDateString();
          const newDay = day !== lastDay;
          lastDay = day;
          return (
            <Fragment key={message.id}>
              {newDay && (
                <div className={classes.day} role="separator">
                  <span className={classes.dayLabel}>{formatDayLabel(message.timestamp, now)}</span>
                </div>
              )}
              <MessageBubble message={message} />
            </Fragment>
          );
        })
      )}
    </div>
  );
}, "chatPage.Feed");

/**
 * Right column: header (back, title, delete), the message feed and the input. `onBack` is told
 * which chat "back" closed, so the page can return focus to its row in the list.
 */
export const ChatWindow = reatomComponent(
  ({ className, onBack }: { className?: string; onBack?: (chatId: string) => void }) => {
    const chat = activeChatAtom();
    const rootClass = className ? `${classes.window} ${className}` : classes.window;

    if (!chat) {
      return (
        <div className={rootClass} data-empty>
          <EmptyState>Выберите чат или создайте новый</EmptyState>
        </div>
      );
    }

    return (
      <div className={rootClass}>
        <header className={classes.header}>
          {/* Only a narrow screen shows one column; there "back" returns to the list. */}
          <ActionIcon
            variant="subtle"
            color="gray"
            hiddenFrom="sm"
            aria-label="Назад к чатам"
            onClick={wrap(() => {
              onBack?.(chat.chatId);
              activeChatIdAtom.set(null);
            })}
          >
            <IconArrowLeft />
          </ActionIcon>
          <ChatAvatar chat={chat} size={40} />
          <Title order={2} size="h4" className={classes.title}>
            {chat.title}
          </Title>
          <DeleteChatButton chatId={chat.chatId} />
        </header>
        <Feed key={chat.chatId} />
        <Composer />
      </div>
    );
  },
  "chatPage.ChatWindow",
);
