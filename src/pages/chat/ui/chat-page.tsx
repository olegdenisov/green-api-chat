import { Text, Title } from "@mantine/core";
import { reatomComponent } from "@reatom/react";

import { activeChatAtom } from "@/entities/chat";

import { Sidebar } from "./sidebar";

import classes from "./chat-page.module.css";

/**
 * Chat screen: `sidebar | window`. On a narrow screen only one column is shown —
 * `data-view` switches it by the active chat.
 */
export const ChatPage = reatomComponent(() => {
  const chat = activeChatAtom();
  return (
    <div className={classes.page} data-view={chat ? "chat" : "list"}>
      <Sidebar className={classes.sidebar} />
      {/* The chat window stub; the window itself lands in the next task. */}
      <main className={classes.window}>
        {chat ? (
          <Title order={2} size="h4">
            {chat.title}
          </Title>
        ) : (
          <Text c="dimmed">Выберите чат или создайте новый</Text>
        )}
      </main>
    </div>
  );
}, "ChatPage");
