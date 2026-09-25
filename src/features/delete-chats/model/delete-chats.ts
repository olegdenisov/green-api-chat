import { action } from "@reatom/core";

import { clearChats, removeChat } from "@/entities/chat";
import { clearMessages, removeChatMessages } from "@/entities/message";

// Entities do not know about each other: this feature ties a chat to its history.

/** Removes the chat and its messages; drops the selection if it was the active chat. */
export const deleteChat = action((chatId: string) => {
  removeChat(chatId);
  removeChatMessages(chatId);
}, "deleteChats.deleteChat");

/** Removes every chat, every message and the selection (logout). */
export const deleteAllChats = action(() => {
  clearChats();
  clearMessages();
}, "deleteChats.deleteAllChats");
