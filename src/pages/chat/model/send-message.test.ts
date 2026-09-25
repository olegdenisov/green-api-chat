import { context, notify, wrap } from "@reatom/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { activeChatIdAtom, chatsAtom, sortedChatsAtom, type Chat } from "@/entities/chat";
import { messagesAtom, SEND_TIMEOUT, type Message } from "@/entities/message";
import { credentialsAtom, logout } from "@/entities/session";

import { sendMessageResponse } from "@test/fixtures/green-api/send-message";
import {
  calledMethods,
  creds,
  deferFetch,
  fetchMock,
  hangUntilAbort,
  respondByMethod,
  stubFetch,
} from "@test/green-api";

import { draftField, retryChatMessage, sendChatMessage, sendDraft } from "./send-message";

const friend: Chat = {
  chatId: "10000000",
  title: "Friend",
  phone: "79991234567",
  lastMessageAt: 1,
};
const colleague: Chat = { chatId: "20000000", title: "Colleague", lastMessageAt: 2 };

/**
 * Logged in with two chats, `friend` selected. `notify()` flushes the selection change hook
 * (it clears the draft), otherwise it would run later and wipe a draft typed in the test.
 */
function setup() {
  credentialsAtom.set(creds);
  chatsAtom.set({ [friend.chatId]: friend, [colleague.chatId]: colleague });
  activeChatIdAtom.set(friend.chatId);
  notify();
}

function messagesOf(chatId: string): Message[] {
  return messagesAtom()[chatId] ?? [];
}

/** Types into the draft; flushes the field change hooks. */
function type(value: string) {
  draftField.change(value);
  notify();
}

beforeEach(stubFetch);

describe("sendChatMessage", () => {
  it("shows the message as sending, then sent with the idMessage", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const response = deferFetch();
    await context.start(async () => {
      setup();
      const pending = sendChatMessage(friend.chatId, "Hello");

      const [sending] = messagesOf(friend.chatId);
      expect(sending).toEqual({
        id: expect.stringMatching(/^local-/),
        chatId: friend.chatId,
        text: "Hello",
        direction: "out",
        status: "sending",
        timestamp: 1000,
        attemptAt: 1000,
      });
      await wrap(vi.waitFor(() => expect(response.pending()).toBe(1)));
      const init = fetchMock.mock.calls[0]![1];
      expect(JSON.parse(String(init?.body))).toEqual({ chatId: friend.chatId, message: "Hello" });

      response.resolveNext(sendMessageResponse);
      await wrap(pending);

      expect(messagesOf(friend.chatId)).toEqual([
        { ...sending, id: sendMessageResponse.idMessage, status: "sent" },
      ]);
    });
  });

  it("marks the message failed on an error, without rejecting", async () => {
    respondByMethod({ sendMessage: { body: {}, status: 500 } });
    await context.start(async () => {
      setup();
      const result = await wrap(sendChatMessage(friend.chatId, "Hello"));
      expect(result).toBeUndefined();
      expect(messagesOf(friend.chatId).map((message) => message.status)).toEqual(["failed"]);
    });
  });

  it("marks the message failed on a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await context.start(async () => {
      setup();
      await wrap(sendChatMessage(friend.chatId, "Hello"));
      expect(messagesOf(friend.chatId).map((message) => message.status)).toEqual(["failed"]);
    });
  });

  it("raises the chat in the list", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    respondByMethod({ sendMessage: { body: sendMessageResponse } });
    await context.start(async () => {
      setup();
      expect(sortedChatsAtom()[0]?.chatId).toBe(colleague.chatId);
      await wrap(sendChatMessage(friend.chatId, "Hello"));
      expect(chatsAtom()[friend.chatId]?.lastMessageAt).toBe(1000);
      expect(sortedChatsAtom()[0]?.chatId).toBe(friend.chatId);
    });
  });

  it("two sends in a row: both sending, then both sent with different idMessage", async () => {
    const response = deferFetch();
    await context.start(async () => {
      setup();
      const first = sendChatMessage(friend.chatId, "One");
      const second = sendChatMessage(friend.chatId, "Two");
      expect(messagesOf(friend.chatId).map((message) => message.status)).toEqual([
        "sending",
        "sending",
      ]);

      await wrap(vi.waitFor(() => expect(response.pending()).toBe(2)));
      // Out of order: the second send is answered first.
      response.resolveAt(1, { idMessage: "1002" });
      await wrap(second);
      response.resolveNext({ idMessage: "1001" });
      await wrap(first);

      expect(
        messagesOf(friend.chatId).map(({ text, id, status }) => ({ text, id, status })),
      ).toEqual([
        { text: "One", id: "1001", status: "sent" },
        { text: "Two", id: "1002", status: "sent" },
      ]);
    });
  });

  it("switching chats does not cancel the send", async () => {
    const response = deferFetch();
    await context.start(async () => {
      setup();
      const pending = sendChatMessage(friend.chatId, "Hello");
      await wrap(vi.waitFor(() => expect(response.pending()).toBe(1)));

      activeChatIdAtom.set(colleague.chatId);
      notify();
      expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(false);

      response.resolveNext(sendMessageResponse);
      await wrap(pending);
      expect(messagesOf(friend.chatId).map((message) => message.status)).toEqual(["sent"]);
    });
  });

  it("logout mid-send does not bring the chat's messages back", async () => {
    const response = deferFetch();
    await context.start(async () => {
      setup();
      const pending = sendChatMessage(friend.chatId, "Hello");
      await wrap(vi.waitFor(() => expect(response.pending()).toBe(1)));

      logout();
      // Stands in for the logout cleanup in `app` (not imported here).
      messagesAtom.set({});
      response.resolveNext(sendMessageResponse);
      await wrap(pending);

      expect(messagesAtom()).toEqual({});
    });
  });

  it("logout mid-send drops a late answer for the old session", async () => {
    const response = deferFetch();
    await context.start(async () => {
      setup();
      const pending = sendChatMessage(friend.chatId, "Hello");
      await wrap(vi.waitFor(() => expect(response.pending()).toBe(1)));

      logout();
      response.resolveNext(sendMessageResponse);
      await wrap(pending);

      expect(messagesOf(friend.chatId).map((message) => message.status)).toEqual(["sending"]);
    });
  });

  it("logout mid-send drops a late error for the old session", async () => {
    const response = deferFetch();
    await context.start(async () => {
      setup();
      const pending = sendChatMessage(friend.chatId, "Hello");
      await wrap(vi.waitFor(() => expect(response.pending()).toBe(1)));

      logout();
      response.rejectNext(new TypeError("Failed to fetch"));
      await wrap(pending);

      expect(messagesOf(friend.chatId).map((message) => message.status)).toEqual(["sending"]);
    });
  });

  it("throws without a GREEN-API client", () => {
    context.start(() => {
      expect(() => sendChatMessage(friend.chatId, "Hello")).toThrow("No GREEN-API client");
      expect(messagesAtom()).toEqual({});
    });
  });

  it("keeps the local id when the answer has no idMessage", async () => {
    respondByMethod({ sendMessage: { body: {} } });
    await context.start(async () => {
      setup();
      const pending = sendChatMessage(friend.chatId, "Hello");
      const [sending] = messagesOf(friend.chatId);
      await wrap(pending);

      expect(messagesOf(friend.chatId)).toEqual([{ ...sending, status: "sent" }]);
    });
  });

  it("makes a local id without crypto.randomUUID (plain HTTP is not a secure context)", async () => {
    vi.stubGlobal("crypto", {});
    respondByMethod({ sendMessage: { body: sendMessageResponse } });
    await context.start(async () => {
      setup();
      const pending = sendChatMessage(friend.chatId, "Hello");
      expect(messagesOf(friend.chatId)[0]?.id).toMatch(/^local-./);
      await wrap(pending);
      expect(messagesOf(friend.chatId)[0]?.status).toBe("sent");
    });
  });
  it("works without AbortSignal.any (Safari < 17.4, Chrome < 116)", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, "any");
    Object.defineProperty(AbortSignal, "any", { value: undefined, configurable: true });
    try {
      respondByMethod({ sendMessage: { body: sendMessageResponse } });
      await context.start(async () => {
        setup();
        await wrap(sendChatMessage(friend.chatId, "Hello"));
        expect(messagesOf(friend.chatId).map((message) => message.status)).toEqual(["sent"]);
      });
    } finally {
      if (descriptor) Object.defineProperty(AbortSignal, "any", descriptor);
    }
  });
});

describe("send timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // A reset does not abort the request: it settles by the send timeout, and the action must
  // resolve, not reject (it is never awaited in the app).
  it("a frame reset mid-send settles without an unhandled rejection", async () => {
    vi.useFakeTimers();
    hangUntilAbort();
    const frame = context.start();
    const pending = frame.run(() => {
      setup();
      return sendChatMessage(friend.chatId, "Hello");
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledOnce();

    frame.run(() => context.reset());
    await vi.advanceTimersByTimeAsync(SEND_TIMEOUT);

    await expect(pending).resolves.toBeUndefined();
    // Neither the request nor the send timer belong to the frame: the timeout still fires and
    // the attempt is honestly `failed` (not left `sending` forever).
    context.start(() => {
      expect(messagesOf(friend.chatId).map((message) => message.status)).toEqual(["failed"]);
    });
  });

  it("a send without an answer becomes failed after SEND_TIMEOUT", async () => {
    vi.useFakeTimers();
    hangUntilAbort();
    await context.start(async () => {
      setup();
      const pending = sendChatMessage(friend.chatId, "Hello");
      await wrap(vi.advanceTimersByTimeAsync(SEND_TIMEOUT - 1));
      expect(messagesOf(friend.chatId).map((message) => message.status)).toEqual(["sending"]);

      await wrap(vi.advanceTimersByTimeAsync(1));
      await wrap(pending);
      expect(messagesOf(friend.chatId).map((message) => message.status)).toEqual(["failed"]);
    });
  });
});

describe("retryChatMessage", () => {
  it("sends a failed message again with the same text", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await context.start(async () => {
      setup();
      await wrap(sendChatMessage(friend.chatId, "Hello"));
      const [failed] = messagesOf(friend.chatId);
      expect(failed?.status).toBe("failed");

      respondByMethod({ sendMessage: { body: sendMessageResponse } });
      await wrap(retryChatMessage(friend.chatId, failed!.id));

      expect(messagesOf(friend.chatId)).toEqual([
        { ...failed, id: sendMessageResponse.idMessage, status: "sent" },
      ]);
      const init = fetchMock.mock.calls[1]![1];
      expect(JSON.parse(String(init?.body))).toEqual({ chatId: friend.chatId, message: "Hello" });
    });
  });

  it("shows the retry as sending with a new attemptAt", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await context.start(async () => {
      setup();
      await wrap(sendChatMessage(friend.chatId, "Hello"));
      const [failed] = messagesOf(friend.chatId);

      const response = deferFetch();
      now.mockReturnValue(5000);
      const pending = retryChatMessage(friend.chatId, failed!.id);
      expect(messagesOf(friend.chatId)).toEqual([
        { ...failed, status: "sending", timestamp: 1000, attemptAt: 5000 },
      ]);

      await wrap(vi.waitFor(() => expect(response.pending()).toBe(1)));
      response.resolveNext(sendMessageResponse);
      await wrap(pending);
      expect(messagesOf(friend.chatId)[0]?.status).toBe("sent");
    });
  });

  it("retries a stale sending message: new attemptAt, then sent", async () => {
    const stale: Message = {
      id: "local-stale",
      chatId: friend.chatId,
      text: "Hello",
      direction: "out",
      status: "sending",
      timestamp: 1000,
      attemptAt: 1000,
    };
    const now = 1000 + SEND_TIMEOUT + 1;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const response = deferFetch();
    await context.start(async () => {
      setup();
      messagesAtom.set({ [friend.chatId]: [stale] });

      const pending = retryChatMessage(friend.chatId, stale.id);
      expect(messagesOf(friend.chatId)[0]?.attemptAt).toBe(now);

      await wrap(vi.waitFor(() => expect(response.pending()).toBe(1)));
      response.resolveNext(sendMessageResponse);
      await wrap(pending);
      expect(messagesOf(friend.chatId)).toEqual([
        { ...stale, id: sendMessageResponse.idMessage, status: "sent", attemptAt: now },
      ]);
    });
  });

  it("a late failure of the previous attempt does not overwrite the retry", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    const response = deferFetch();
    await context.start(async () => {
      setup();
      const first = sendChatMessage(friend.chatId, "Hello");
      const [sending] = messagesOf(friend.chatId);
      await wrap(vi.waitFor(() => expect(response.pending()).toBe(1)));

      // The first attempt's timer is late (a throttled tab): the user already retries.
      now.mockReturnValue(1000 + SEND_TIMEOUT + 1);
      const retry = retryChatMessage(friend.chatId, sending!.id);
      await wrap(vi.waitFor(() => expect(response.pending()).toBe(2)));

      response.rejectNext(new TypeError("Failed to fetch"));
      await wrap(first);
      expect(messagesOf(friend.chatId).map((message) => message.status)).toEqual(["sending"]);

      response.resolveNext(sendMessageResponse);
      await wrap(retry);
      expect(messagesOf(friend.chatId)).toEqual([
        {
          ...sending,
          id: sendMessageResponse.idMessage,
          status: "sent",
          attemptAt: 1000 + SEND_TIMEOUT + 1,
        },
      ]);
    });
  });

  it("drops a retry answered after logout", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await context.start(async () => {
      setup();
      await wrap(sendChatMessage(friend.chatId, "Hello"));
      const [failed] = messagesOf(friend.chatId);

      const response = deferFetch();
      const pending = retryChatMessage(friend.chatId, failed!.id);
      await wrap(vi.waitFor(() => expect(response.pending()).toBe(1)));
      logout();
      response.resolveNext(sendMessageResponse);
      await wrap(pending);

      expect(messagesOf(friend.chatId).map(({ id, status }) => ({ id, status }))).toEqual([
        { id: failed!.id, status: "sending" },
      ]);
    });
  });

  it("throws without a GREEN-API client", () => {
    context.start(() => {
      expect(() => retryChatMessage(friend.chatId, "local-1")).toThrow("No GREEN-API client");
    });
  });

  it("ignores a fresh sending, a sent, an incoming and an unknown message", async () => {
    const base: Message = {
      id: "local-1",
      chatId: friend.chatId,
      text: "Hello",
      direction: "out",
      status: "sending",
      timestamp: 1000,
      attemptAt: 1000,
    };
    const list: Message[] = [
      base,
      { ...base, id: "sent", status: "sent" },
      { ...base, id: "in", direction: "in", status: "failed" },
    ];
    vi.spyOn(Date, "now").mockReturnValue(1000 + SEND_TIMEOUT);
    await context.start(async () => {
      setup();
      messagesAtom.set({ [friend.chatId]: list });
      for (const id of ["local-1", "sent", "in", "404"]) {
        await wrap(retryChatMessage(friend.chatId, id));
      }
      expect(calledMethods()).toEqual([]);
      expect(messagesOf(friend.chatId)).toEqual(list);
    });
  });
});

describe("sendDraft", () => {
  it("sends the trimmed draft to the active chat and clears it at once", async () => {
    const response = deferFetch();
    await context.start(async () => {
      setup();
      type("  Hello  ");
      sendDraft();

      expect(draftField()).toBe("");
      expect(messagesOf(friend.chatId).map(({ text, status }) => ({ text, status }))).toEqual([
        { text: "Hello", status: "sending" },
      ]);
      await wrap(vi.waitFor(() => expect(response.pending()).toBe(1)));
      response.resolveNext(sendMessageResponse);
      await wrap(vi.waitFor(wrap(() => expect(messagesOf(friend.chatId)[0]?.status).toBe("sent"))));
    });
  });

  it.each(["", "   \n  "])("does nothing for blank text %j", (value) => {
    context.start(() => {
      setup();
      type(value);
      sendDraft();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(messagesAtom()).toEqual({});
      expect(draftField()).toBe(value);
    });
  });

  it("does nothing without an active chat", () => {
    context.start(() => {
      setup();
      activeChatIdAtom.set(null);
      notify();
      type("Hello");
      sendDraft();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(messagesAtom()).toEqual({});
      expect(draftField()).toBe("Hello");
    });
  });

  it("does nothing for a dangling active chat id", () => {
    context.start(() => {
      setup();
      activeChatIdAtom.set("404");
      notify();
      type("Hello");
      sendDraft();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(messagesAtom()).toEqual({});
    });
  });

  it("switching chats clears the draft", () => {
    context.start(() => {
      setup();
      type("Hello");
      activeChatIdAtom.set(colleague.chatId);
      notify();
      expect(draftField()).toBe("");
    });
  });
});
