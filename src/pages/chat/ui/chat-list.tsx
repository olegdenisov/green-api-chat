import { NavLink, Text } from "@mantine/core";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";

import { activeChatIdAtom, sortedChatsAtom } from "@/entities/chat";
import { messagesAtom } from "@/entities/message";

import { formatChatTime } from "../lib/format-time";

import classes from "./chat-list.module.css";

/** Chats, newest first: title, last message, time; a click selects the chat. */
export const ChatList = reatomComponent(() => {
  const chats = sortedChatsAtom();
  const messages = messagesAtom();
  const activeChatId = activeChatIdAtom();

  if (chats.length === 0) {
    return (
      <Text c="dimmed" size="sm" className={classes.empty}>
        Создайте чат по номеру телефона
      </Text>
    );
  }

  const now = Date.now();
  return (
    <ul className={classes.list} aria-label="Чаты">
      {chats.map((chat) => {
        const active = chat.chatId === activeChatId;
        return (
          <li key={chat.chatId}>
            <NavLink
              component="button"
              type="button"
              className={classes.item}
              label={chat.title}
              description={messages[chat.chatId]?.at(-1)?.text}
              rightSection={
                <span className={classes.time}>{formatChatTime(chat.lastMessageAt, now)}</span>
              }
              active={active}
              aria-current={active ? "true" : undefined}
              noWrap
              onClick={wrap(() => activeChatIdAtom.set(chat.chatId))}
            />
          </li>
        );
      })}
    </ul>
  );
}, "chatPage.ChatList");
