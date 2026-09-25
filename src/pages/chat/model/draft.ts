import { action, reatomField, withChangeHook } from "@reatom/core";

import { activeChatAtom, activeChatIdAtom } from "@/entities/chat";

import { sendChatMessage } from "./send-message";

/** The message input; one draft for all chats. */
export const draftField = reatomField("", "chatPage.draft");

/**
 * Sends the draft to the active chat and clears it right away (the send is not awaited).
 * Blank text or no active chat — nothing happens.
 */
export const sendDraft = action(() => {
  const text = draftField().trim();
  const chat = activeChatAtom();
  if (text === "" || !chat) return;
  draftField.reset();
  void sendChatMessage(chat.chatId, text);
}, "chatPage.sendDraft");

// The draft belongs to the chat it was typed in: switching chats (including "back" on a narrow
// screen) drops it.
activeChatIdAtom.extend(withChangeHook(() => draftField.reset()));
