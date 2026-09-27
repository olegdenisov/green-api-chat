import { context } from "@reatom/core";
import { describe, expect, it } from "vitest";

import { activeChatIdAtom, chatsAtom, type Chat } from "@/entities/chat";
import { messagesAtom, type Message } from "@/entities/message";

import { applyMessageStatus, applyReceivedMessage } from "./apply-notification";
import type { ReceivedMessage, ReceivedStatus } from "./parse-notification";

const chatId = "10000000";

const incoming: ReceivedMessage = {
  kind: "message",
  chatId,
  chatName: "Василиса",
  id: "1763115112345",
  text: "Привет",
  direction: "in",
  viaApi: false,
  timestamp: 5000,
};

const apiEvent: ReceivedMessage = {
  kind: "message",
  chatId,
  id: "api-1",
  text: "ок",
  direction: "out",
  viaApi: true,
  timestamp: 6000,
};

const existingChat: Chat = { chatId, title: "Старое имя", phone: "79991234567", lastMessageAt: 1 };

function outgoing(id: string, status: Message["status"], text = "ок", timestamp = 1000): Message {
  return { id, chatId, text, direction: "out", status, timestamp, attemptAt: timestamp };
}

function messagesOf(id = chatId): Message[] {
  return messagesAtom()[id] ?? [];
}

describe("applyReceivedMessage", () => {
  it("creates the chat of a message from a new sender without selecting it", () => {
    context.start(() => {
      activeChatIdAtom.set("20000000");
      applyReceivedMessage(incoming);

      expect(chatsAtom()[chatId]).toEqual({ chatId, title: "Василиса", lastMessageAt: 5000 });
      expect(activeChatIdAtom()).toBe("20000000");
      expect(messagesOf()).toEqual([
        {
          id: incoming.id,
          chatId,
          text: "Привет",
          direction: "in",
          status: "sent",
          timestamp: 5000,
        },
      ]);
    });
  });

  it("titles a new chat by chatId without a chatName", () => {
    context.start(() => {
      applyReceivedMessage({ ...incoming, chatName: undefined });
      expect(chatsAtom()[chatId]?.title).toBe(chatId);
    });
  });

  it("updates the title and raises an existing chat, keeping its phone", () => {
    context.start(() => {
      chatsAtom.set({ [chatId]: existingChat });
      applyReceivedMessage(incoming);

      expect(chatsAtom()[chatId]).toEqual({
        ...existingChat,
        title: "Василиса",
        lastMessageAt: 5000,
      });
      expect(messagesOf().map((message) => message.id)).toEqual([incoming.id]);
    });
  });

  it("adds an outgoing phone message as sent", () => {
    context.start(() => {
      applyReceivedMessage({ ...incoming, id: "phone-1", direction: "out" });
      expect(messagesOf()).toEqual([
        expect.objectContaining({ id: "phone-1", direction: "out", status: "sent" }),
      ]);
    });
  });

  it("does not add the same idMessage twice", () => {
    context.start(() => {
      applyReceivedMessage(incoming);
      const snapshot = messagesAtom();
      applyReceivedMessage(incoming);

      expect(messagesAtom()).toBe(snapshot);
      expect(messagesOf()).toHaveLength(1);
    });
  });

  it("a repeated idMessage still raises the chat", () => {
    context.start(() => {
      applyReceivedMessage(incoming);
      chatsAtom.set((chats) => ({ ...chats, [chatId]: { ...chats[chatId]!, lastMessageAt: 1 } }));
      applyReceivedMessage(incoming);
      expect(chatsAtom()[chatId]?.lastMessageAt).toBe(5000);
    });
  });
});

describe("applyReceivedMessage: matching API sends", () => {
  it("gives a pending sending message the idMessage and marks it sent", () => {
    context.start(() => {
      chatsAtom.set({ [chatId]: existingChat });
      const sending = outgoing("local-1", "sending");
      messagesAtom.set({ [chatId]: [sending] });

      applyReceivedMessage(apiEvent);

      expect(messagesOf()).toEqual([{ ...sending, id: "api-1", status: "sent" }]);
      expect(chatsAtom()[chatId]?.lastMessageAt).toBe(6000);
    });
  });

  it("matches a stale sending message too", () => {
    context.start(() => {
      // `timestamp` far in the past: the message is stale by now.
      const stale = outgoing("local-1", "sending", "ок", 1);
      messagesAtom.set({ [chatId]: [stale] });

      applyReceivedMessage(apiEvent);

      expect(messagesOf()).toEqual([{ ...stale, id: "api-1", status: "sent" }]);
    });
  });

  it("prefers a sending message over an older failed one", () => {
    context.start(() => {
      const failed = outgoing("local-failed", "failed", "ок", 1000);
      const sending = outgoing("local-sending", "sending", "ок", 2000);
      messagesAtom.set({ [chatId]: [failed, sending] });

      applyReceivedMessage(apiEvent);

      expect(messagesOf()).toEqual([failed, { ...sending, id: "api-1", status: "sent" }]);
    });
  });

  it("matches a failed message when nothing is sending", () => {
    context.start(() => {
      const failed = outgoing("local-failed", "failed");
      messagesAtom.set({ [chatId]: [failed] });

      applyReceivedMessage(apiEvent);

      expect(messagesOf()).toEqual([{ ...failed, id: "api-1", status: "sent" }]);
    });
  });

  it("matches two same-text sends in order", () => {
    context.start(() => {
      const first = outgoing("local-1", "sending", "ок", 1000);
      const second = outgoing("local-2", "sending", "ок", 2000);
      messagesAtom.set({ [chatId]: [first, second] });

      applyReceivedMessage(apiEvent);
      expect(messagesOf().map(({ id, status }) => ({ id, status }))).toEqual([
        { id: "api-1", status: "sent" },
        { id: "local-2", status: "sending" },
      ]);

      applyReceivedMessage({ ...apiEvent, id: "api-2" });
      expect(messagesOf().map(({ id, status }) => ({ id, status }))).toEqual([
        { id: "api-1", status: "sent" },
        { id: "api-2", status: "sent" },
      ]);
    });
  });

  it("ignores pending sends with another text, sent and incoming messages", () => {
    context.start(() => {
      const list: Message[] = [
        outgoing("local-other", "sending", "другое"),
        outgoing("sent-1", "sent"),
        { ...outgoing("in-1", "failed"), direction: "in" },
      ];
      messagesAtom.set({ [chatId]: list });

      applyReceivedMessage(apiEvent);

      expect(messagesOf()).toEqual([
        ...list,
        {
          id: "api-1",
          chatId,
          text: "ок",
          direction: "out",
          status: "sent",
          timestamp: 6000,
        },
      ]);
    });
  });

  it("ignores a pending send with the same text in another chat", () => {
    context.start(() => {
      const otherChatId = "20000000";
      const other: Message = { ...outgoing("local-other", "sending"), chatId: otherChatId };
      messagesAtom.set({ [otherChatId]: [other] });

      applyReceivedMessage(apiEvent);

      expect(messagesOf(otherChatId)).toEqual([other]);
      expect(messagesOf()).toEqual([
        expect.objectContaining({ id: "api-1", text: "ок", direction: "out", status: "sent" }),
      ]);
    });
  });

  it("a phone send with the same text is added separately, the pending send is untouched", () => {
    context.start(() => {
      const sending = outgoing("local-1", "sending");
      messagesAtom.set({ [chatId]: [sending] });

      applyReceivedMessage({ ...apiEvent, id: "phone-1", viaApi: false });

      expect(messagesOf()).toEqual([
        sending,
        expect.objectContaining({ id: "phone-1", direction: "out", status: "sent" }),
      ]);
    });
  });

  it("a repeated API event after matching adds nothing", () => {
    context.start(() => {
      messagesAtom.set({
        [chatId]: [outgoing("local-1", "sending"), outgoing("local-2", "failed")],
      });

      applyReceivedMessage(apiEvent);
      applyReceivedMessage(apiEvent);

      expect(messagesOf().map(({ id, status }) => ({ id, status }))).toEqual([
        { id: "api-1", status: "sent" },
        { id: "local-2", status: "failed" },
      ]);
    });
  });
});

describe("applyMessageStatus", () => {
  const status = (value: ReceivedStatus["status"], id = "api-1"): ReceivedStatus => ({
    kind: "status",
    chatId,
    id,
    status: value,
  });

  const statusOf = (id = "api-1") => messagesOf().find((message) => message.id === id)?.status;

  it("raises sent → delivered → read", () => {
    context.start(() => {
      messagesAtom.set({ [chatId]: [outgoing("api-1", "sent")] });

      applyMessageStatus(status("delivered"));
      expect(statusOf()).toBe("delivered");

      applyMessageStatus(status("read"));
      expect(statusOf()).toBe("read");
    });
  });

  it("raises sent straight to read", () => {
    context.start(() => {
      messagesAtom.set({ [chatId]: [outgoing("api-1", "sent")] });
      applyMessageStatus(status("read"));
      expect(statusOf()).toBe("read");
    });
  });

  it("keeps read when delivered comes after it", () => {
    context.start(() => {
      messagesAtom.set({ [chatId]: [outgoing("api-1", "sent")] });
      applyMessageStatus(status("read"));
      const snapshot = messagesAtom();

      applyMessageStatus(status("delivered"));

      expect(statusOf()).toBe("read");
      expect(messagesAtom()).toBe(snapshot);
    });
  });

  it("a repeated status changes nothing", () => {
    context.start(() => {
      messagesAtom.set({ [chatId]: [outgoing("api-1", "sent")] });
      applyMessageStatus(status("delivered"));
      const snapshot = messagesAtom();

      applyMessageStatus(status("delivered"));

      expect(messagesAtom()).toBe(snapshot);
    });
  });

  it.each(["sending", "failed"] as const)("leaves a %s message alone", (current) => {
    context.start(() => {
      messagesAtom.set({ [chatId]: [outgoing("api-1", current)] });
      const snapshot = messagesAtom();

      applyMessageStatus(status("read"));

      expect(messagesAtom()).toBe(snapshot);
    });
  });

  it("leaves an incoming message alone", () => {
    context.start(() => {
      messagesAtom.set({ [chatId]: [{ ...outgoing("api-1", "sent"), direction: "in" }] });
      const snapshot = messagesAtom();

      applyMessageStatus(status("read"));

      expect(messagesAtom()).toBe(snapshot);
    });
  });

  it("an unknown id changes nothing and does not raise the chat", () => {
    context.start(() => {
      chatsAtom.set({ [chatId]: existingChat });
      messagesAtom.set({ [chatId]: [outgoing("api-1", "sent")] });
      const messages = messagesAtom();
      const chats = chatsAtom();

      applyMessageStatus(status("read", "unknown"));

      expect(messagesAtom()).toBe(messages);
      expect(chatsAtom()).toBe(chats);
    });
  });

  it("a status for another chat leaves a message with the same id alone", () => {
    context.start(() => {
      messagesAtom.set({ [chatId]: [outgoing("api-1", "sent")] });
      const snapshot = messagesAtom();

      applyMessageStatus({ ...status("read"), chatId: "20000000" });

      expect(messagesAtom()).toBe(snapshot);
      expect(statusOf()).toBe("sent");
    });
  });

  it("an unknown chat is not created", () => {
    context.start(() => {
      applyMessageStatus(status("delivered"));

      expect(messagesAtom()).toEqual({});
      expect(chatsAtom()).toEqual({});
    });
  });
});
