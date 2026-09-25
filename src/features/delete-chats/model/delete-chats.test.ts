import { context } from "@reatom/core";
import { describe, expect, it } from "vitest";

import { activeChatIdAtom, type Chat, chatsAtom, openChat } from "@/entities/chat";
import { addMessage, type Message, messagesAtom } from "@/entities/message";

import { deleteAllChats, deleteChat } from "./delete-chats";

const alice: Chat = { chatId: "1001", title: "alice", phone: "79991234567", lastMessageAt: 100 };
const bob: Chat = { chatId: "1002", title: "bob", lastMessageAt: 200 };
const toAlice: Message = {
  id: "local-1",
  chatId: alice.chatId,
  text: "Hello",
  direction: "out",
  status: "sent",
  timestamp: 100,
  attemptAt: 100,
};
const toBob: Message = { ...toAlice, id: "local-2", chatId: bob.chatId, text: "Ping" };

function seed() {
  openChat(bob);
  openChat(alice);
  addMessage(toAlice);
  addMessage(toBob);
}

describe("deleteChat", () => {
  it("removes the chat and only its messages, dropping the selection", () => {
    context.start(() => {
      seed();

      deleteChat(alice.chatId);

      expect(chatsAtom()).toEqual({ [bob.chatId]: bob });
      expect(messagesAtom()).toEqual({ [bob.chatId]: [toBob] });
      expect(activeChatIdAtom()).toBeNull();
    });
  });

  it("keeps the selection when another chat is deleted", () => {
    context.start(() => {
      seed();

      deleteChat(bob.chatId);

      expect(chatsAtom()).toEqual({ [alice.chatId]: alice });
      expect(messagesAtom()).toEqual({ [alice.chatId]: [toAlice] });
      expect(activeChatIdAtom()).toBe(alice.chatId);
    });
  });
});

describe("deleteAllChats", () => {
  it("clears chats, messages and the selection", () => {
    context.start(() => {
      seed();

      deleteAllChats();

      expect(chatsAtom()).toEqual({});
      expect(messagesAtom()).toEqual({});
      expect(activeChatIdAtom()).toBeNull();
    });
  });
});
