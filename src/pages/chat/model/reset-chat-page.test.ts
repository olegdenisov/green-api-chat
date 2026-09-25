import { context, isAbort, notify, wrap } from "@reatom/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { activeChatIdAtom, chatsAtom } from "@/entities/chat";
import { credentialsAtom } from "@/entities/session";

import { fetchMock, creds, hangUntilAbort, stubFetch } from "@test/green-api";

import { createChatForm } from "./create-chat";
import { resetChatPage } from "./reset-chat-page";
import { draftField } from "./draft";

beforeEach(stubFetch);

describe("resetChatPage", () => {
  it("clears the new-chat form, cancels its request and clears the draft", async () => {
    hangUntilAbort();
    await context.start(async () => {
      credentialsAtom.set(creds);
      chatsAtom.set({ "1": { chatId: "1", title: "Friend", lastMessageAt: 1 } });
      activeChatIdAtom.set("1");
      notify();
      draftField.change("Hello");
      createChatForm.fields.phone.change("79876543210");
      notify();
      const pending = createChatForm.submit();
      await wrap(vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()));

      resetChatPage();
      const reason: unknown = await wrap(pending.catch((error: unknown) => error));

      expect(isAbort(reason)).toBe(true);
      expect(createChatForm.submit.ready()).toBe(true);
      expect(createChatForm.submit.error()).toBeUndefined();
      expect(createChatForm.fields.phone()).toBe("");
      expect(draftField()).toBe("");
    });
  });
});
