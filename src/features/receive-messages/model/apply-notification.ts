import { action } from "@reatom/core";

import { receiveChat, touchChat } from "@/entities/chat";
import { addMessage, messagesAtom, updateMessage, type Message } from "@/entities/message";

import type { ReceivedMessage } from "./parse-notification";

/**
 * The oldest outgoing message of this send still waiting with the same text: `sending`
 * (stale ones included) first, then `failed`. `sending` goes first: otherwise the event of a
 * new send would mark as sent an older `failed` one with the same text that never left.
 */
function findPendingSend(list: readonly Message[], text: string): Message | undefined {
  const pending = list.filter((message) => message.direction === "out" && message.text === text);
  return (
    pending.find((message) => message.status === "sending") ??
    pending.find((message) => message.status === "failed")
  );
}

/**
 * Puts a received message into its chat. The chat is created if needed (never selected);
 * a known `idMessage` is not added twice; an API-sent message (`viaApi`) is matched with a
 * pending local send of the same text instead of being added. Idempotent: a notification
 * returned by the queue again changes nothing.
 */
export const applyReceivedMessage = action((message: ReceivedMessage) => {
  const { chatId, chatName, id, text, direction, viaApi, timestamp } = message;
  receiveChat({ chatId, title: chatName, timestamp });

  const list = messagesAtom()[chatId] ?? [];
  if (!list.some((item) => item.id === id)) {
    // Only API events are matched: a phone send with the same text is another message.
    const pending = viaApi ? findPendingSend(list, text) : undefined;
    if (pending) {
      updateMessage(chatId, pending.id, { id, status: "sent" });
    } else {
      addMessage({ id, chatId, text, direction, status: "sent", timestamp });
    }
  }

  touchChat(chatId, timestamp);
}, "receiveMessages.apply");
