import { context, notify, wrap } from "@reatom/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { activeChatIdAtom, chatsAtom, type Chat } from "@/entities/chat";
import { messagesAtom, type Message } from "@/entities/message";
import { credentialsAtom } from "@/entities/session";

import { sendMessageResponse } from "@test/fixtures/green-api/send-message";
import { deferFetch, fetchMock, stubFetch, creds } from "@test/green-api";

import { draftField, sendDraft } from "./draft";

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
