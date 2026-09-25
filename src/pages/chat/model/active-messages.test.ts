import { context } from "@reatom/core";
import { describe, expect, it } from "vitest";

import { activeChatIdAtom, chatsAtom, type Chat } from "@/entities/chat";
import { messagesAtom, type Message } from "@/entities/message";

import { activeMessagesAtom } from "./active-messages";

const chat: Chat = { chatId: "10000000", title: "Friend", lastMessageAt: 1 };
const other: Chat = { chatId: "20000000", title: "Colleague", lastMessageAt: 2 };
const hello: Message = {
  id: "1001",
  chatId: chat.chatId,
  text: "Hello",
  direction: "out",
  status: "sent",
  timestamp: 1,
  attemptAt: 1,
};
const ping: Message = { ...hello, id: "1002", chatId: other.chatId, text: "Ping" };

describe("activeMessagesAtom", () => {
  it("is empty without an active chat", () => {
    context.start(() => {
      chatsAtom.set({ [chat.chatId]: chat });
      messagesAtom.set({ [chat.chatId]: [hello] });
      expect(activeMessagesAtom()).toEqual([]);
    });
  });

  it("is empty for a chat without messages", () => {
    context.start(() => {
      chatsAtom.set({ [chat.chatId]: chat, [other.chatId]: other });
      messagesAtom.set({ [other.chatId]: [ping] });
      activeChatIdAtom.set(chat.chatId);
      expect(activeMessagesAtom()).toEqual([]);
    });
  });

  it("is empty for a dangling active chat id", () => {
    context.start(() => {
      messagesAtom.set({ [chat.chatId]: [hello] });
      activeChatIdAtom.set(chat.chatId);
      expect(activeMessagesAtom()).toEqual([]);
    });
  });

  it("lists the active chat's messages and follows the selection", () => {
    context.start(() => {
      chatsAtom.set({ [chat.chatId]: chat, [other.chatId]: other });
      messagesAtom.set({ [chat.chatId]: [hello], [other.chatId]: [ping] });
      activeChatIdAtom.set(chat.chatId);
      expect(activeMessagesAtom()).toEqual([hello]);
      activeChatIdAtom.set(other.chatId);
      expect(activeMessagesAtom()).toEqual([ping]);
    });
  });
});
