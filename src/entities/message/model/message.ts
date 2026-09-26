import { action, atom, withLocalStorage } from "@reatom/core";

import { PERSIST_TTL } from "@/shared/config";

export type Message = {
  /** `idMessage` from GREEN-API or `local-<uuid>` until the send succeeds. */
  id: string;
  chatId: string;
  text: string;
  direction: "in" | "out";
  status: "sending" | "sent" | "failed";
  /** ms. */
  timestamp: number;
  /** ms, start of the last send attempt; outgoing messages only. */
  attemptAt?: number;
};

export type Messages = Record<string, Message[]>;

type MessagePatch = Partial<Omit<Message, "chatId">>;

/** A send without an answer for this long is a failure (ms). */
export const SEND_TIMEOUT = 30_000;

// Typed `unknown[]` so that `.includes()` accepts the unchecked stored value; `satisfies` still
// checks the literals against `Message`.
const DIRECTIONS: readonly unknown[] = ["in", "out"] satisfies Message["direction"][];
const STATUSES: readonly unknown[] = ["sending", "sent", "failed"] satisfies Message["status"][];

function isTime(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMessage(value: unknown, chatId: string): value is Message {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<Record<keyof Message, unknown>>;
  return (
    typeof message.id === "string" &&
    message.id !== "" &&
    message.chatId === chatId &&
    typeof message.text === "string" &&
    DIRECTIONS.includes(message.direction) &&
    STATUSES.includes(message.status) &&
    isTime(message.timestamp) &&
    (message.attemptAt === undefined || isTime(message.attemptAt))
  );
}

/**
 * Shape check of the stored messages: broken messages are dropped, not the whole snapshot;
 * a chat whose value is not a list is dropped. No transformations (a `sending` message stays
 * `sending`) — with the storage subscription it runs after the atom's own writes too, so valid
 * data is returned as is (the same object).
 */
export function toMessages(snapshot: unknown): Messages {
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) return {};
  let changed = false;
  const result: Messages = {};
  for (const [chatId, list] of Object.entries(snapshot)) {
    if (chatId === "" || !Array.isArray(list)) {
      changed = true;
      continue;
    }
    const valid = list.filter((message) => isMessage(message, chatId));
    if (valid.length !== list.length) changed = true;
    result[chatId] = valid;
  }
  return changed ? result : (snapshot as Messages);
}

/** Messages by `chatId`, in the order they were added. Synced across tabs through `storage`. */
export const messagesAtom = atom<Messages>({}, "message.byChat").extend(
  withLocalStorage({ key: "ga.messages", time: PERSIST_TTL, fromSnapshot: toMessages }),
);

/** The moment (ms) after which a `sending` message counts as stale: its attempt + `SEND_TIMEOUT`. */
export function sendingStaleAt(message: Message): number {
  return (message.attemptAt ?? message.timestamp) + SEND_TIMEOUT;
}

/**
 * An outgoing `sending` message past `sendingStaleAt`: the send was interrupted (a closed
 * tab, a reload), so it is shown as `failed`.
 */
export function isSendingStale(message: Message, now: number): boolean {
  return (
    message.direction === "out" && message.status === "sending" && now > sendingStaleAt(message)
  );
}

/** Whether the chat has a message with this id. Reads `messagesAtom`: call it in a frame. */
export function hasMessage(chatId: string, id: string): boolean {
  return messagesAtom()[chatId]?.some((message) => message.id === id) ?? false;
}

/** Appends the message to its chat. */
export const addMessage = action((message: Message) => {
  messagesAtom.set((messages) => ({
    ...messages,
    [message.chatId]: [...(messages[message.chatId] ?? []), message],
  }));
}, "message.add");

/**
 * Patches the message by id (including a new `id`). Unknown chat or id — no-op: the chat key
 * is never created, so a late answer does not bring back a deleted history.
 */
export const updateMessage = action((chatId: string, id: string, patch: MessagePatch) => {
  if (!hasMessage(chatId, id)) return;
  const next = (messagesAtom()[chatId] ?? []).map((message) =>
    message.id === id ? { ...message, ...patch } : message,
  );
  messagesAtom.set((messages) => ({ ...messages, [chatId]: next }));
}, "message.update");

/** Removes the message by id. Unknown chat or id — no-op: the chat key is never created. */
export const removeMessage = action((chatId: string, id: string) => {
  if (!hasMessage(chatId, id)) return;
  const next = (messagesAtom()[chatId] ?? []).filter((message) => message.id !== id);
  messagesAtom.set((messages) => ({ ...messages, [chatId]: next }));
}, "message.remove");

export const removeChatMessages = action((chatId: string) => {
  if (!(chatId in messagesAtom())) return;
  messagesAtom.set(({ [chatId]: _removed, ...rest }) => rest);
}, "message.removeChat");

export const clearMessages = action(() => {
  messagesAtom.set({});
}, "message.clear");
