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
  // `undefined` until the first run: the chat open at mount is not a change.
  const lastChatId = useRef<string | null | undefined>(undefined);
  const chatId = chat?.chatId ?? null;

  // The focus follows the active chat only when it is lost — fell to <body> because the focused
  // control unmounted. A focus that is somewhere else already (a clicked row, the form while
  // another tab deletes the chat) is left alone.
  // - A chat is opened (the new-chat form closed after a submit, a row hidden on a narrow
  //   screen): the message input gets it.
  // - A chat is left ("back", delete): the row of the left chat gets it, or the list if the row
  //   is gone (delete).
  useEffect(() => {
    const previous = lastChatId.current;
    lastChatId.current = chatId;
    if (previous === undefined || previous === chatId) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const root = rootRef.current;
    if (chatId !== null) {
      root?.querySelector<HTMLElement>('textarea[aria-label="Сообщение"]')?.focus();
      return;
    }
    if (previous === null) return;
    // Quoted attribute value: only `"` and `\` need escaping (jsdom has no `CSS.escape`).
    const value = previous.replace(/["\\]/g, "\\$&");
    const row = root?.querySelector<HTMLElement>(`nav [data-chat-id="${value}"]`);
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
