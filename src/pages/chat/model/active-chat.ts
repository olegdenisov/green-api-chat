import { computed } from "@reatom/core";

import { activeChatAtom } from "@/entities/chat";
import { messagesAtom, type Message } from "@/entities/message";

const NO_MESSAGES: readonly Message[] = [];

/** Messages of the active chat, in the order they were added; `[]` without a chat. */
export const activeMessagesAtom = computed((): readonly Message[] => {
  const chat = activeChatAtom();
  if (!chat) return NO_MESSAGES;
  return messagesAtom()[chat.chatId] ?? NO_MESSAGES;
}, "chat.activeMessages");
