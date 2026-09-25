import { context, sleep, wrap } from "@reatom/core";
import { describe, expect, it, onTestFinished } from "vitest";

import {
  activeChatAtom,
  activeChatIdAtom,
  type Chat,
  chatsAtom,
  clearChats,
  findChatByPhone,
  openChat,
  removeChat,
  sortedChatsAtom,
  toActiveChatId,
  toChats,
  touchChat,
} from "./chat";

const alice: Chat = { chatId: "1001", title: "alice", phone: "79991234567", lastMessageAt: 100 };
const bob: Chat = {
  chatId: "1002",
  title: "+79997654321",
  phone: "79997654321",
  lastMessageAt: 200,
};
const carol: Chat = { chatId: "1003", title: "carol", lastMessageAt: 300 };

/** Simulates another tab writing `key`: the browser fires `storage` in this one. */
function dispatchStorage(key: string, oldValue: string | null) {
  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      oldValue,
      newValue: localStorage.getItem(key),
      storageArea: localStorage,
    }),
  );
}

describe("chat", () => {
  it("is empty by default", () => {
    context.start(() => {
      expect(chatsAtom()).toEqual({});
      expect(activeChatIdAtom()).toBeNull();
      expect(activeChatAtom()).toBeNull();
      expect(sortedChatsAtom()).toEqual([]);
    });
  });

  describe("openChat", () => {
    it("adds a new chat and selects it", () => {
      context.start(() => {
        openChat(alice);
        expect(chatsAtom()).toEqual({ [alice.chatId]: alice });
        expect(activeChatIdAtom()).toBe(alice.chatId);
        expect(activeChatAtom()).toEqual(alice);
      });
    });

    it("keeps an existing chat but fills in its phone", () => {
      context.start(() => {
        const incoming: Chat = { chatId: alice.chatId, title: "Alice Liddell", lastMessageAt: 500 };
        openChat(incoming);
        openChat(bob);

        openChat({ ...alice, title: "other", lastMessageAt: 900 });
        expect(chatsAtom()[alice.chatId]).toEqual({ ...incoming, phone: alice.phone });
        expect(activeChatIdAtom()).toBe(alice.chatId);
      });
    });

    it("does not rewrite an existing chat without a phone", () => {
      context.start(() => {
        openChat(alice);
        const before = chatsAtom();
        openChat({ chatId: alice.chatId, title: "other", lastMessageAt: 900 });
        expect(chatsAtom()).toBe(before);
      });
    });
  });

  describe("touchChat", () => {
    it("raises lastMessageAt", () => {
      context.start(() => {
        openChat(alice);
        touchChat(alice.chatId, 150);
        expect(chatsAtom()[alice.chatId]?.lastMessageAt).toBe(150);
      });
    });

    it("never lowers lastMessageAt", () => {
      context.start(() => {
        openChat(alice);
        touchChat(alice.chatId, 50);
        expect(chatsAtom()[alice.chatId]?.lastMessageAt).toBe(100);
      });
    });

    it("is a no-op for an unknown chat", () => {
      context.start(() => {
        openChat(alice);
        const before = chatsAtom();
        touchChat("404", 1000);
        expect(chatsAtom()).toBe(before);
      });
    });
  });

  it("sorts chats by lastMessageAt, newest first", () => {
    context.start(() => {
      openChat(bob);
      openChat(carol);
      openChat(alice);
      expect(sortedChatsAtom().map((chat) => chat.chatId)).toEqual(["1003", "1002", "1001"]);

      touchChat(alice.chatId, 1000);
      expect(sortedChatsAtom().map((chat) => chat.chatId)).toEqual(["1001", "1003", "1002"]);
    });
  });

  it("activeChatAtom is null for a dangling id", () => {
    context.start(() => {
      openChat(alice);
      activeChatIdAtom.set("404");
      expect(activeChatAtom()).toBeNull();
    });
  });

  describe("removeChat", () => {
    it("drops the selection when the active chat is removed", () => {
      context.start(() => {
        openChat(bob);
        openChat(alice);
        removeChat(alice.chatId);
        expect(chatsAtom()).toEqual({ [bob.chatId]: bob });
        expect(activeChatIdAtom()).toBeNull();
      });
    });

    it("keeps the selection when another chat is removed", () => {
      context.start(() => {
        openChat(bob);
        openChat(alice);
        removeChat(bob.chatId);
        expect(chatsAtom()).toEqual({ [alice.chatId]: alice });
        expect(activeChatIdAtom()).toBe(alice.chatId);
      });
    });
  });

  it("clearChats removes all chats and the selection", () => {
    context.start(() => {
      openChat(bob);
      openChat(alice);
      clearChats();
      expect(chatsAtom()).toEqual({});
      expect(activeChatIdAtom()).toBeNull();
    });
  });

  it("findChatByPhone finds a chat by its normalized phone", () => {
    context.start(() => {
      openChat(alice);
      openChat(carol);
      expect(findChatByPhone("79991234567")).toEqual(alice);
      expect(findChatByPhone("70000000000")).toBeUndefined();
    });
  });

  describe("persist", () => {
    it("keeps chats and the selection across frames", () => {
      context.start(() => {
        openChat(bob);
        openChat(alice);
      });

      context.start(() => {
        expect(chatsAtom()).toEqual({ [alice.chatId]: alice, [bob.chatId]: bob });
        expect(activeChatIdAtom()).toBe(alice.chatId);
        expect(activeChatAtom()).toEqual(alice);
      });
    });

    it("toChats keeps valid data as is", () => {
      const chats = { [alice.chatId]: alice, [carol.chatId]: carol };
      expect(toChats(chats)).toBe(chats);
    });

    it("toChats drops broken entries only", () => {
      expect(
        toChats({
          [alice.chatId]: alice,
          "1": null,
          "2": "chat",
          "3": { chatId: "3", title: 3, lastMessageAt: 1 },
          "4": { chatId: "4", title: "x", lastMessageAt: "1" },
          "5": { chatId: "5", title: "x", phone: 5, lastMessageAt: 1 },
          "6": { chatId: "other", title: "x", lastMessageAt: 1 },
        }),
      ).toEqual({ [alice.chatId]: alice });
    });

    it("toChats falls back to no chats on a non-object", () => {
      expect(toChats(null)).toEqual({});
      expect(toChats("chats")).toEqual({});
      expect(toChats([alice])).toEqual({});
    });

    it("toActiveChatId accepts a non-empty string only", () => {
      expect(toActiveChatId("1001")).toBe("1001");
      expect(toActiveChatId("")).toBeNull();
      expect(toActiveChatId(1001)).toBeNull();
      expect(toActiveChatId(null)).toBeNull();
    });
  });

  describe("sync across tabs", () => {
    it("chatsAtom follows a write made in another tab", async () => {
      await context.start(async () => {
        openChat(alice);
        const before = localStorage.getItem("ga.chats");
        // The storage subscription lives while the atom is connected; connection is async.
        onTestFinished(chatsAtom.subscribe(() => {}));
        await wrap(sleep(0));

        context.start(() => openChat(bob));
        dispatchStorage("ga.chats", before);

        expect(chatsAtom()).toEqual({ [alice.chatId]: alice, [bob.chatId]: bob });
      });
    });

    it("activeChatIdAtom ignores a selection made in another tab", async () => {
      await context.start(async () => {
        openChat(alice);
        openChat(bob);
        activeChatIdAtom.set(alice.chatId);
        const before = localStorage.getItem("ga.activeChatId");
        onTestFinished(activeChatIdAtom.subscribe(() => {}));
        await wrap(sleep(0));

        context.start(() => activeChatIdAtom.set(bob.chatId));
        expect(localStorage.getItem("ga.activeChatId")).toContain(bob.chatId);
        dispatchStorage("ga.activeChatId", before);

        expect(activeChatIdAtom()).toBe(alice.chatId);
      });
    });
  });
});
