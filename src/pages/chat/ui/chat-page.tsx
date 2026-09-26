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
  // The chat closed by "back": its row in the list gets the focus once the list is shown.
  const closedChatId = useRef<string | null>(null);
  const isOpen = chat !== null;

  useEffect(() => {
    const chatId = closedChatId.current;
    if (isOpen || chatId === null) return;
    closedChatId.current = null;
    const root = rootRef.current;
    const row = Array.from(root?.querySelectorAll<HTMLElement>("nav [data-chat-id]") ?? []).find(
      (element) => element.dataset.chatId === chatId,
    );
    (row ?? root?.querySelector<HTMLElement>("nav"))?.focus();
  }, [isOpen]);

  return (
    <div ref={rootRef} className={classes.root}>
      <ConnectionIndicator />
      <main className={classes.page} data-view={chat ? "chat" : "list"}>
        <Sidebar className={classes.sidebar} />
        <ChatWindow
          className={classes.window}
          onBack={(chatId) => {
            closedChatId.current = chatId;
          }}
        />
      </main>
    </div>
  );
}, "chatPage.ChatPage");
