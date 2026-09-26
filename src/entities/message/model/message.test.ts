import { context, sleep, wrap } from "@reatom/core";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import {
  addMessage,
  clearMessages,
  isSendingStale,
  type Message,
  messagesAtom,
  removeChatMessages,
  removeMessage,
  SEND_TIMEOUT,
  sendingStaleAt,
  toMessages,
  updateMessage,
} from "./message";

const hello: Message = {
  id: "local-1",
  chatId: "1001",
  text: "Hello",
  direction: "out",
  status: "sending",
  timestamp: 100,
  attemptAt: 100,
};
const reply: Message = {
  id: "BAE5F4886AE3D0E1",
  chatId: "1001",
  text: "Hi!",
  direction: "in",
  status: "sent",
  timestamp: 200,
};
const other: Message = {
  id: "local-2",
  chatId: "1002",
  text: "Ping",
  direction: "out",
  status: "sent",
  timestamp: 300,
  attemptAt: 300,
};

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

describe("message", () => {
  it("is empty by default", () => {
    context.start(() => {
      expect(messagesAtom()).toEqual({});
    });
  });

  it("addMessage appends to the chat's list", () => {
    context.start(() => {
      addMessage(hello);
      addMessage(other);
      addMessage(reply);
      expect(messagesAtom()).toEqual({
        [hello.chatId]: [hello, reply],
        [other.chatId]: [other],
      });
    });
  });

  describe("updateMessage", () => {
    it("patches the message by id, including a new id", () => {
      context.start(() => {
        addMessage(hello);
        addMessage(reply);
        updateMessage(hello.chatId, hello.id, { id: "BAE5367237E13A87", status: "sent" });
        expect(messagesAtom()[hello.chatId]).toEqual([
          { ...hello, id: "BAE5367237E13A87", status: "sent" },
          reply,
        ]);
      });
    });

    it("is a no-op for an unknown id", () => {
      context.start(() => {
        addMessage(hello);
        const before = messagesAtom();
        updateMessage(hello.chatId, "404", { status: "failed" });
        expect(messagesAtom()).toBe(before);
      });
    });

    it("is a no-op for an unknown chat and does not create its key", () => {
      context.start(() => {
        addMessage(hello);
        const before = messagesAtom();
        updateMessage("404", hello.id, { status: "failed" });
        expect(messagesAtom()).toBe(before);
        expect("404" in messagesAtom()).toBe(false);
      });
    });
  });

  describe("removeMessage", () => {
    it("removes the message by id", () => {
      context.start(() => {
        addMessage(hello);
        addMessage(reply);
        addMessage(other);
        removeMessage(hello.chatId, hello.id);
        expect(messagesAtom()).toEqual({
          [hello.chatId]: [reply],
          [other.chatId]: [other],
        });
      });
    });

    it("is a no-op for an unknown id", () => {
      context.start(() => {
        addMessage(hello);
        const before = messagesAtom();
        removeMessage(hello.chatId, "404");
        expect(messagesAtom()).toBe(before);
      });
    });

    it("is a no-op for an unknown chat and does not create its key", () => {
      context.start(() => {
        addMessage(hello);
        const before = messagesAtom();
        removeMessage("404", hello.id);
        expect(messagesAtom()).toBe(before);
        expect("404" in messagesAtom()).toBe(false);
      });
    });
  });

  it("removeChatMessages removes only that chat's messages", () => {
    context.start(() => {
      addMessage(hello);
      addMessage(other);
      removeChatMessages(hello.chatId);
      expect(messagesAtom()).toEqual({ [other.chatId]: [other] });
    });
  });

  it("clearMessages removes all messages", () => {
    context.start(() => {
      addMessage(hello);
      addMessage(other);
      clearMessages();
      expect(messagesAtom()).toEqual({});
    });
  });

  describe("sendingStaleAt", () => {
    it("is the last attempt plus SEND_TIMEOUT", () => {
      expect(sendingStaleAt({ ...hello, attemptAt: 10_000 })).toBe(10_000 + SEND_TIMEOUT);
    });

    it("falls back to the timestamp without an attempt", () => {
      const { attemptAt: _attemptAt, ...noAttempt } = hello;
      expect(sendingStaleAt(noAttempt)).toBe(hello.timestamp + SEND_TIMEOUT);
    });
  });

  describe("isSendingStale", () => {
    it("is false for a fresh sending message", () => {
      expect(isSendingStale(hello, hello.attemptAt! + SEND_TIMEOUT)).toBe(false);
    });

    it("is true for a sending message older than SEND_TIMEOUT", () => {
      expect(isSendingStale(hello, hello.attemptAt! + SEND_TIMEOUT + 1)).toBe(true);
    });

    it("counts from the last attempt, not the first send", () => {
      const retried = { ...hello, attemptAt: 10_000 };
      expect(isSendingStale(retried, hello.timestamp + SEND_TIMEOUT + 1)).toBe(false);
    });

    it("is false for sent, failed and incoming messages", () => {
      const late = hello.attemptAt! + SEND_TIMEOUT * 10;
      expect(isSendingStale({ ...hello, status: "sent" }, late)).toBe(false);
      expect(isSendingStale({ ...hello, status: "failed" }, late)).toBe(false);
      expect(isSendingStale({ ...hello, direction: "in" }, late)).toBe(false);
    });
  });

  describe("persist", () => {
    it("keeps messages across frames, sending as is", () => {
      context.start(() => {
        addMessage(hello);
        addMessage(reply);
        addMessage(other);
      });

      context.start(() => {
        expect(messagesAtom()).toEqual({
          [hello.chatId]: [hello, reply],
          [other.chatId]: [other],
        });
      });
    });

    it("keeps messages for more than a year", () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      onTestFinished(() => {
        vi.useRealTimers();
      });

      context.start(() => {
        addMessage(hello);
      });
      vi.setSystemTime(Date.now() + 400 * 24 * 60 * 60 * 1000);

      context.start(() => {
        expect(messagesAtom()).toEqual({ [hello.chatId]: [hello] });
      });
    });

    it("two sending messages in a row both stay sending", () => {
      const second: Message = { ...hello, id: "local-3", text: "Second" };
      context.start(() => {
        addMessage(hello);
        addMessage(second);
        expect(messagesAtom()[hello.chatId]?.map((message) => message.status)).toEqual([
          "sending",
          "sending",
        ]);
      });

      context.start(() => {
        expect(messagesAtom()[hello.chatId]).toEqual([hello, second]);
      });
    });

    it("toMessages keeps valid data as is", () => {
      const messages = { [hello.chatId]: [hello, reply], [other.chatId]: [other] };
      expect(toMessages(messages)).toBe(messages);
    });

    it("toMessages drops broken messages only", () => {
      expect(
        toMessages({
          [hello.chatId]: [
            hello,
            null,
            "message",
            { ...reply, id: "" },
            { ...reply, chatId: "other" },
            { ...reply, text: 1 },
            { ...reply, direction: "up" },
            { ...reply, status: "read" },
            { ...reply, timestamp: "200" },
            { ...reply, attemptAt: Number.NaN },
            reply,
          ],
          [other.chatId]: other,
        }),
      ).toEqual({ [hello.chatId]: [hello, reply] });
    });

    it("toMessages falls back to no messages on a non-object", () => {
      expect(toMessages(null)).toEqual({});
      expect(toMessages("messages")).toEqual({});
      expect(toMessages([hello])).toEqual({});
    });
  });

  describe("sync across tabs", () => {
    it("messagesAtom follows a write made in another tab", async () => {
      await context.start(async () => {
        addMessage(hello);
        const before = localStorage.getItem("ga.messages");
        // The storage subscription lives while the atom is connected; connection is async.
        onTestFinished(messagesAtom.subscribe(() => {}));
        await wrap(sleep(0));

        context.start(() => addMessage(other));
        dispatchStorage("ga.messages", before);

        expect(messagesAtom()).toEqual({
          [hello.chatId]: [hello],
          [other.chatId]: [other],
        });
      });
    });
  });
});
