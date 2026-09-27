import { action } from "@reatom/core";

import { receiveChat, touchChat } from "@/entities/chat";
import {
  addMessage,
  hasMessage,
  messagesAtom,
  updateMessage,
  type Message,
} from "@/entities/message";

import type { ReceivedMessage, ReceivedStatus } from "./parse-notification";

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

  if (!hasMessage(chatId, id)) {
    // Only API events are matched: a phone send with the same text is another message.
    const pending = viaApi ? findPendingSend(messagesAtom()[chatId] ?? [], text) : undefined;
    if (pending) {
      updateMessage(chatId, pending.id, { id, status: "sent" });
    } else {
      addMessage({ id, chatId, text, direction, status: "sent", timestamp });
    }
  }

  touchChat(chatId, timestamp);
}, "receiveMessages.apply");

/** Rank of the statuses a notification may raise: a status only ever goes up. */
const RANK = { sent: 1, delivered: 2, read: 3 } as const satisfies Partial<
  Record<Message["status"], number>
>;

const isRanked = (status: Message["status"]): status is keyof typeof RANK => status in RANK;

/**
 * Raises an outgoing message found by `idMessage` to `delivered`/`read`. Only `sent`/`delivered`
 * messages are raised, and only to a higher rank: a repeat from the queue or `delivered` after
 * `read` changes nothing. Incoming, `sending`/`failed` (local id), unknown chat or id — no-op;
 * the chat is neither created nor raised in the list.
 */
export const applyMessageStatus = action(({ chatId, id, status }: ReceivedStatus) => {
  const message = messagesAtom()[chatId]?.find((item) => item.id === id);
  if (!message || message.direction !== "out" || !isRanked(message.status)) return;
  if (RANK[status] <= RANK[message.status]) return;
  updateMessage(chatId, id, { status });
}, "receiveMessages.applyStatus");
