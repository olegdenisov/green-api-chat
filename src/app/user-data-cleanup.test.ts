import { context, notify, sleep, wrap } from "@reatom/core";
import { describe, expect, it, onTestFinished } from "vitest";

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

function expectNoData() {
  expect(chatsAtom()).toEqual({});
  expect(messagesAtom()).toEqual({});
  expect(activeChatIdAtom()).toBeNull();
}

/** Logged in (in an earlier frame, like a previous page load) with a chat and a message. */
function seedLoggedIn() {
  context.start(() => {
    credentialsAtom.set(creds);
    seed();
  });
}

describe("user data cleanup", () => {
  it("clears chats, messages and the selection on logout", () => {
    seedLoggedIn();
    context.start(() => {
      expect(chatsAtom()).toEqual({ [alice.chatId]: alice });

      logout();
      // The change hook runs in the hooks phase, not synchronously inside `logout`.
      notify();

      expectNoData();
    });
  });

  it("keeps the data on login", () => {
    context.start(() => {
      credentialsAtom();
      notify();
      seed();

      credentialsAtom.set(creds);
      notify();

      expect(chatsAtom()).toEqual({ [alice.chatId]: alice });
      expect(messagesAtom()).toEqual({ [alice.chatId]: [toAlice] });
      expect(activeChatIdAtom()).toBe(alice.chatId);
    });
  });

  it("keeps the data on start with credentials", () => {
    seedLoggedIn();
    context.start(() => {
      expect(credentialsAtom()).toEqual(creds);
      notify();

      expect(chatsAtom()).toEqual({ [alice.chatId]: alice });
      expect(messagesAtom()).toEqual({ [alice.chatId]: [toAlice] });
    });
  });

  it("clears data left without credentials on start", () => {
    // The credentials are gone (expired, broken, removed by hand), the chats are not.
    seedLoggedIn();
    localStorage.removeItem("ga.credentials");

    context.start(() => {
      expect(credentialsAtom()).toBeNull();
      notify();

      expectNoData();
    });
  });

  it("does nothing on logout while logged out", () => {
    context.start(() => {
      expect(() => {
        logout();
        notify();
      }).not.toThrow();

      expectNoData();
    });
  });

  it("does not bring the data back in a new frame", () => {
    seedLoggedIn();
    context.start(() => {
      logout();
      notify();
    });

    context.start(() => {
      expect(credentialsAtom()).toBeNull();
      expectNoData();
    });
  });

  it("clears the data on a logout in another tab", async () => {
    seedLoggedIn();
    await context.start(async () => {
      activeChatIdAtom.set(alice.chatId);
      const loggedIn = localStorage.getItem("ga.credentials");
      // The storage subscription lives while the atom is connected; connection is async.
      onTestFinished(credentialsAtom.subscribe(() => {}));
      await wrap(sleep(0));

      // Another tab logs out: it rewrites the key and the browser fires `storage` here.
      context.start(() => logout());
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ga.credentials",
          oldValue: loggedIn,
          newValue: localStorage.getItem("ga.credentials"),
          storageArea: localStorage,
        }),
      );
      notify();

      expect(credentialsAtom()).toBeNull();
      expectNoData();
    });
  });
});
