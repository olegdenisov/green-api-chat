import { reatomComponent } from "@reatom/react";
import { useEffect, useRef } from "react";

import { activeChatAtom } from "@/entities/chat";
import { ConnectionIndicator } from "@/features/receive-messages";

import { createChatOpenAtom } from "../model/create-chat";
import { ChatWindow } from "./chat-window";
import { Sidebar } from "./sidebar";

import classes from "./chat-page.module.css";

/**
 * Whether the focus is lost: on <body>, or on an element that is not rendered. Without
 * `checkVisibility` (Safari < 17.4, jsdom) only <body> counts.
 */
function isFocusLost(): boolean {
  const active = document.activeElement;
  if (!active || active === document.body) return true;
  return active.checkVisibility?.() === false;
}

/**
 * Chat screen: `sidebar | window`. On a narrow screen only one column is shown —
 * `data-view` switches it by the active chat. The connection indicator sits above both
 * columns, so it is visible in either narrow-screen view.
 */
export const ChatPage = reatomComponent(() => {
  const chat = activeChatAtom();
  const formOpen = createChatOpenAtom();
  const rootRef = useRef<HTMLDivElement>(null);
  // `undefined` until the first run: the chat open at mount is not a change.
  const lastChatId = useRef<string | null | undefined>(undefined);
  const lastFormOpen = useRef(formOpen);
  const chatId = chat?.chatId ?? null;

  // The focus follows the active chat only when it is lost: it fell to <body> because the
  // focused control unmounted, or it stays on a control that is no longer rendered (a clicked
  // row whose column got `display: none` on a narrow screen — the effect runs before the
  // browser moves such a focus to <body>). A focus that is somewhere visible already (a clicked
  // row on a wide screen, the form while another tab deletes the chat) is left alone.
  // - A chat is opened, or the new-chat form closed after a submit (also for the number of the
  //   chat already open — the chat does not change then): the message input gets it.
  // - A chat is left ("back", delete): the row of the left chat gets it, or the list if the row
  //   is gone (delete).
  useEffect(() => {
    const previous = lastChatId.current;
    lastChatId.current = chatId;
    const formClosed = lastFormOpen.current && !formOpen;
    lastFormOpen.current = formOpen;
    const chatChanged = previous !== undefined && previous !== chatId;
    if (!chatChanged && !formClosed) return;
    if (!isFocusLost()) return;
    const root = rootRef.current;
    if (chatId !== null) {
      root?.querySelector<HTMLElement>("[data-composer-input]")?.focus();
      return;
    }
    if (!chatChanged || previous === null) return;
    // Quoted attribute value: only `"` and `\` need escaping (jsdom has no `CSS.escape`).
    const value = previous.replace(/["\\]/g, "\\$&");
    const row = root?.querySelector<HTMLElement>(`nav [data-chat-id="${value}"]`);
    (row ?? root?.querySelector<HTMLElement>("nav"))?.focus();
  }, [chatId, formOpen]);

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
