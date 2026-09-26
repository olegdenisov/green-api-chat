import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";

import { activeChatIdAtom, sortedChatsAtom } from "@/entities/chat";
import { messagesAtom } from "@/entities/message";

import { formatChatTime } from "../lib/format-time";
import { ChatAvatar } from "./chat-avatar";
import { EmptyState } from "./empty-state";

import classes from "./chat-list.module.css";

/** Chats, newest first: avatar, title, time and the last message; a click selects the chat. */
export const ChatList = reatomComponent(() => {
  const chats = sortedChatsAtom();
  const messages = messagesAtom();
  const activeChatId = activeChatIdAtom();

  if (chats.length === 0) {
    return <EmptyState>Создайте чат по номеру телефона</EmptyState>;
  }

  const now = Date.now();
  return (
    <ul className={classes.list}>
      {chats.map((chat) => {
        const active = chat.chatId === activeChatId;
        const last = messages[chat.chatId]?.at(-1);
        return (
          <li key={chat.chatId}>
            <button
              type="button"
              className={classes.item}
              data-chat-id={chat.chatId}
              data-active={active || undefined}
              aria-current={active ? "true" : undefined}
              onClick={wrap(() => activeChatIdAtom.set(chat.chatId))}
            >
              <ChatAvatar chat={chat} />
              <span className={classes.body}>
                <span className={classes.top}>
                  <span className={classes.title}>{chat.title}</span>
                  <span className={classes.time}>{formatChatTime(chat.lastMessageAt, now)}</span>
                </span>
                <span className={classes.preview}>
                  {last && (last.direction === "out" ? `Вы: ${last.text}` : last.text)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}, "chatPage.ChatList");
