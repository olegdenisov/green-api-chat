import { reatomComponent } from "@reatom/react";
import { useEffect, useRef } from "react";

import { activeChatAtom } from "@/entities/chat";
import { ConnectionIndicator } from "@/features/receive-messages";

import { ChatWindow } from "./chat-window";
import { Sidebar } from "./sidebar";

import classes from "./chat-page.module.css";

/**
 * Chat screen: `sidebar | window`. On a narrow screen only one column is shown —
 * `data-view` switches it by the active chat. The connection strip sits above both
 * columns, so it is visible in either narrow-screen view.
 */
export const ChatPage = reatomComponent(() => {
  const chat = activeChatAtom();
  const rootRef = useRef<HTMLDivElement>(null);
  const lastChatId = useRef<string | null>(null);
  const chatId = chat?.chatId ?? null;

  // A chat is left ("back", delete): the column with the focused control goes away and the focus
  // falls to <body>. Then the row of the left chat gets it, or the list if the row is gone
  // (delete). A focus that is somewhere else already (another tab deleted the chat while the
  // user types in the form) is left alone.
  useEffect(() => {
    if (chatId !== null) {
      lastChatId.current = chatId;
      return;
    }
    const left = lastChatId.current;
    lastChatId.current = null;
    if (left === null) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const root = rootRef.current;
    const row = Array.from(root?.querySelectorAll<HTMLElement>("nav [data-chat-id]") ?? []).find(
      (element) => element.dataset.chatId === left,
    );
    (row ?? root?.querySelector<HTMLElement>("nav"))?.focus();
  }, [chatId]);

  return (
    <div ref={rootRef} className={classes.root}>
      <ConnectionIndicator />
      <main className={classes.page} data-view={chat ? "chat" : "list"}>
        <Sidebar className={classes.sidebar} />
        <ChatWindow className={classes.window} />
      </main>
    </div>
  );
}, "chatPage.ChatPage");
