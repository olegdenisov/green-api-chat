import { action, atom, computed, withLocalStorage } from "@reatom/core";

import { PERSIST_TTL } from "@/shared/config";

export type Chat = {
  /** Telegram chat id: a number as a string, without `@c.us`. */
  chatId: string;
  /** `username` from `checkAccount` or `+<phone>`. */
  title: string;
  /** Digits only; absent for chats created by an incoming message. */
  phone?: string;
  /** ms; for a new chat — its creation time. */
  lastMessageAt: number;
};

export type Chats = Record<string, Chat>;

function isTime(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isChat(value: unknown, chatId: string): value is Chat {
  if (typeof value !== "object" || value === null) return false;
  const chat = value as Partial<Record<keyof Chat, unknown>>;
  return (
    chat.chatId === chatId &&
    chatId !== "" &&
    typeof chat.title === "string" &&
    (chat.phone === undefined || typeof chat.phone === "string") &&
    isTime(chat.lastMessageAt)
  );
}

/**
 * Shape check of the stored chats: broken entries are dropped, not the whole snapshot.
 * No transformations — with the storage subscription it runs after the atom's own writes too,
 * so valid data is returned as is (the same object).
 */
export function toChats(snapshot: unknown): Chats {
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) return {};
  const entries = Object.entries(snapshot);
  const valid = entries.filter(([chatId, chat]) => isChat(chat, chatId));
  if (valid.length === entries.length) return snapshot as Chats;
  return Object.fromEntries(valid) as Chats;
}

export function toActiveChatId(snapshot: unknown): string | null {
  return typeof snapshot === "string" && snapshot !== "" ? snapshot : null;
}

/** Chats by `chatId`. Synced across tabs through the `storage` event. */
export const chatsAtom = atom<Chats>({}, "chat.list").extend(
  withLocalStorage({ key: "ga.chats", time: PERSIST_TTL, fromSnapshot: toChats }),
);

/**
 * The selected chat. Not synced across tabs (`subscribe: false`): each tab keeps its own
 * selection, otherwise a choice in one tab would switch the others and drop their draft.
 */
export const activeChatIdAtom = atom<string | null>(null, "chat.activeId").extend(
  withLocalStorage({
    key: "ga.activeChatId",
    time: PERSIST_TTL,
    subscribe: false,
    fromSnapshot: toActiveChatId,
  }),
);

/** Chats by `lastMessageAt`, newest first. */
export const sortedChatsAtom = computed(
  () => Object.values(chatsAtom()).sort((a, b) => b.lastMessageAt - a.lastMessageAt),
  "chat.sorted",
);

/** The selected chat; `null` when nothing is selected or the id is dangling. */
export const activeChatAtom = computed(() => {
  const chatId = activeChatIdAtom();
  return chatId === null ? null : (chatsAtom()[chatId] ?? null);
}, "chat.active");

/** Reads `chatsAtom()` in the calling action. */
export function findChatByPhone(phone: string): Chat | undefined {
  return Object.values(chatsAtom()).find((chat) => chat.phone === phone);
}

/** Adds the chat if it is new (an existing one is kept, only `phone` is filled in) and selects it. */
export const openChat = action((chat: Chat) => {
  const existing = chatsAtom()[chat.chatId];
  if (!existing) {
    chatsAtom.set((chats) => ({ ...chats, [chat.chatId]: chat }));
  } else if (chat.phone !== undefined && existing.phone !== chat.phone) {
    chatsAtom.set((chats) => ({ ...chats, [chat.chatId]: { ...existing, phone: chat.phone } }));
  }
  activeChatIdAtom.set(chat.chatId);
}, "chat.open");

/**
 * A chat of a received message: a new one is created **without** selecting it (`title` —
 * the given one or `chatId`); an existing one only gets a non-empty changed `title`.
 * `phone` and the selection are never touched.
 */
export const receiveChat = action(
  ({ chatId, title, timestamp }: { chatId: string; title?: string; timestamp: number }) => {
    const existing = chatsAtom()[chatId];
    if (!existing) {
      const chat: Chat = { chatId, title: title || chatId, lastMessageAt: timestamp };
      chatsAtom.set((chats) => ({ ...chats, [chatId]: chat }));
    } else if (title && existing.title !== title) {
      chatsAtom.set((chats) => ({ ...chats, [chatId]: { ...existing, title } }));
    }
  },
  "chat.receive",
);

/** Raises `lastMessageAt` (never lowers it); unknown chat — no-op. */
export const touchChat = action((chatId: string, timestamp: number) => {
  const chat = chatsAtom()[chatId];
  if (!chat || chat.lastMessageAt >= timestamp) return;
  chatsAtom.set((chats) => ({ ...chats, [chatId]: { ...chat, lastMessageAt: timestamp } }));
}, "chat.touch");

/** Removes the chat; drops the selection if it was the active one. */
export const removeChat = action((chatId: string) => {
  if (chatId in chatsAtom()) {
    chatsAtom.set(({ [chatId]: _removed, ...rest }) => rest);
  }
  if (activeChatIdAtom() === chatId) activeChatIdAtom.set(null);
}, "chat.remove");

export const clearChats = action(() => {
  chatsAtom.set({});
  // Read before the write: in a frame that has not read the atom yet, `set(null)` compares with
  // the default `null` and skips the storage write, so a reload would bring the old id back.
  if (activeChatIdAtom() !== null) activeChatIdAtom.set(null);
}, "chat.clear");
