import { reatomComponent } from "@reatom/react";

import { activeChatAtom } from "@/entities/chat";

import { ChatWindow } from "./chat-window";
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
      <ChatWindow className={classes.window} />
    </div>
  );
}, "ChatPage");
