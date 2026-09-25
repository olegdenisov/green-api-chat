import { context, notify } from "@reatom/core";
import { describe, expect, it } from "vitest";

import { activeChatIdAtom, type Chat, chatsAtom, openChat } from "@/entities/chat";
import { addMessage, type Message, messagesAtom } from "@/entities/message";
import { credentialsAtom, logout } from "@/entities/session";
import { creds } from "@test/green-api";

import "./user-data-cleanup";

const alice: Chat = { chatId: "1001", title: "alice", phone: "79991234567", lastMessageAt: 100 };
const toAlice: Message = {
  id: "local-1",
  chatId: alice.chatId,
  text: "Hello",
  direction: "out",
  status: "sent",
  timestamp: 100,
  attemptAt: 100,
};

function seed() {
  openChat(alice);
  addMessage(toAlice);
}

describe("user data cleanup", () => {
  it("clears chats, messages and the selection on logout", () => {
    context.start(() => {
      credentialsAtom.set(creds);
      seed();

      logout();
      // The change hook runs in the hooks phase, not synchronously inside `logout`.
      notify();

      expect(chatsAtom()).toEqual({});
      expect(messagesAtom()).toEqual({});
      expect(activeChatIdAtom()).toBeNull();
    });
  });

  it("keeps the data on login", () => {
    context.start(() => {
      seed();

      credentialsAtom.set(creds);
      notify();

      expect(chatsAtom()).toEqual({ [alice.chatId]: alice });
      expect(messagesAtom()).toEqual({ [alice.chatId]: [toAlice] });
      expect(activeChatIdAtom()).toBe(alice.chatId);
    });
  });

  it("does nothing on logout while logged out", () => {
    context.start(() => {
      seed();

      expect(() => {
        logout();
        notify();
      }).not.toThrow();

      expect(chatsAtom()).toEqual({ [alice.chatId]: alice });
      expect(messagesAtom()).toEqual({ [alice.chatId]: [toAlice] });
    });
  });

  it("does not bring the data back in a new frame", () => {
    context.start(() => {
      credentialsAtom.set(creds);
      seed();
      logout();
      notify();
    });

    context.start(() => {
      expect(chatsAtom()).toEqual({});
      expect(messagesAtom()).toEqual({});
      expect(activeChatIdAtom()).toBeNull();
    });
  });
});
