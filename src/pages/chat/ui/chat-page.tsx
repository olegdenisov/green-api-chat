import { Text } from "@mantine/core";
import { reatomComponent } from "@reatom/react";

import { sortedChatsAtom } from "@/entities/chat";
import { LogoutButton } from "@/features/auth";
import { AppTitle } from "@/shared/ui";

import classes from "./chat-page.module.css";

/** Chat screen stub: the chat titles for now; the layout lands later in stage 4. */
export const ChatPage = reatomComponent(() => {
  const chats = sortedChatsAtom();
  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <AppTitle size="h3" />
        <LogoutButton />
      </header>
      <main className={classes.body}>
        {chats.length === 0 ? (
          <Text c="dimmed">Чаты появятся здесь</Text>
        ) : (
          <ul>
            {chats.map((chat) => (
              <li key={chat.chatId}>{chat.title}</li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}, "ChatPage");
