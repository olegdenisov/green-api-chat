import { context, isAbort, notify, wrap } from "@reatom/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { activeChatIdAtom, chatsAtom, type Chat } from "@/entities/chat";
import { credentialsAtom, logout } from "@/entities/session";
import { ApiError } from "@/shared/api";

import {
  checkAccountExists,
  checkAccountInstanceNotReady,
  checkAccountNotExists,
  checkAccountRateLimitedByMessenger,
  checkAccountRateLimitExceeded,
} from "@test/fixtures/green-api/check-account";
import {
  calledMethods,
  creds,
  deferFetch,
  fetchMock,
  hangUntilAbort,
  respondByMethod,
  stubFetch,
} from "@test/green-api";

import { CreateChatError } from "./create-chat-error";
import { createChatForm, normalizePhone } from "./create-chat";

const { phone } = createChatForm.fields;

/** Types like a separate input event; flushes the field change hooks (see login-form tests). */
function fill(value: string) {
  phone.change(value);
  notify();
}

/** Submits; the rejection stays available via `submit.error()`. */
function submit() {
  return wrap(createChatForm.submit().catch(() => {}));
}

const existing: Chat = {
  chatId: "20000000",
  title: "Friend",
  phone: "79991234567",
  lastMessageAt: 1,
};

beforeEach(stubFetch);

describe("normalizePhone", () => {
  it("keeps digits only", () => {
    expect(normalizePhone("+7 (999) 123-45-67")).toBe("79991234567");
    expect(normalizePhone(" 8 999 123 45 67 ")).toBe("89991234567");
    expect(normalizePhone("")).toBe("");
  });
});

describe("createChatForm validation", () => {
  it.each<[string, string]>([
    ["", "Введите номер телефона"],
    ["  +()- ", "Введите номер телефона"],
    ["+7 999 123", "Номер — от 10 до 15 цифр в международном формате"],
    ["1234567890123456", "Номер — от 10 до 15 цифр в международном формате"],
  ])("rejects %j", async (value, error) => {
    await context.start(async () => {
      credentialsAtom.set(creds);
      fill(value);
      await submit();
      expect(phone.validation().error).toBe(error);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it.each(["9991234567", "123456789012345"])("accepts %s (10–15 digits)", async (value) => {
    respondByMethod({ checkAccount: { body: checkAccountExists } });
    await context.start(async () => {
      credentialsAtom.set(creds);
      fill(value);
      await submit();
      expect(phone.validation().error).toBeUndefined();
      expect(calledMethods()).toEqual(["checkAccount"]);
    });
  });
});

describe("createChatForm submit", () => {
  it("opens a chat known by the number without a request", async () => {
    await context.start(async () => {
      credentialsAtom.set(creds);
      chatsAtom.set({ [existing.chatId]: existing });
      fill("+7 (999) 123-45-67");
      await submit();

      expect(calledMethods()).toEqual([]);
      expect(activeChatIdAtom()).toBe(existing.chatId);
      expect(chatsAtom()).toEqual({ [existing.chatId]: existing });
      expect(phone()).toBe("");
    });
  });

  it("creates a chat titled by the username and selects it", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    respondByMethod({ checkAccount: { body: checkAccountExists } });
    await context.start(async () => {
      credentialsAtom.set(creds);
      fill("+7 987 654-32-10");
      await submit();

      expect(createChatForm.submit.error()).toBeUndefined();
      const init = fetchMock.mock.calls[0]![1];
      expect(JSON.parse(String(init?.body))).toEqual({ phoneNumber: 79876543210 });
      expect(chatsAtom()).toEqual({
        [checkAccountExists.chatId]: {
          chatId: checkAccountExists.chatId,
          title: "@username",
          phone: "79876543210",
          lastMessageAt: 1000,
        },
      });
      expect(activeChatIdAtom()).toBe(checkAccountExists.chatId);
      expect(phone()).toBe("");
    });
  });

  it("titles a chat without a username by the number", async () => {
    const { username: _username, ...withoutUsername } = checkAccountExists;
    respondByMethod({ checkAccount: { body: withoutUsername } });
    await context.start(async () => {
      credentialsAtom.set(creds);
      fill("79876543210");
      await submit();

      expect(chatsAtom()[checkAccountExists.chatId]?.title).toBe("+79876543210");
    });
  });

  it("does not duplicate a chat that already has the chatId, fills in its phone", async () => {
    respondByMethod({ checkAccount: { body: checkAccountExists } });
    await context.start(async () => {
      credentialsAtom.set(creds);
      const incoming: Chat = { chatId: checkAccountExists.chatId, title: "Name", lastMessageAt: 5 };
      chatsAtom.set({ [incoming.chatId]: incoming });
      fill("79876543210");
      await submit();

      expect(chatsAtom()).toEqual({ [incoming.chatId]: { ...incoming, phone: "79876543210" } });
      expect(activeChatIdAtom()).toBe(incoming.chatId);
    });
  });

  it.each<[string, unknown, number, (error: unknown) => void]>([
    [
      "exist: false",
      checkAccountNotExists,
      200,
      (error) => expect((error as CreateChatError).reason).toBe("not-registered"),
    ],
    [
      "CheckAccountFailure",
      checkAccountInstanceNotReady,
      200,
      (error) => expect((error as CreateChatError).reason).toBe("instance-not-ready"),
    ],
    [
      "rate limit in 200",
      checkAccountRateLimitExceeded,
      200,
      (error) => expect((error as ApiError).kind).toBe("rate-limit"),
    ],
    [
      "HTTP 469",
      checkAccountRateLimitedByMessenger,
      469,
      (error) => expect((error as ApiError).kind).toBe("rate-limit"),
    ],
    ["HTTP 401", {}, 401, (error) => expect((error as ApiError).kind).toBe("auth")],
    ["HTTP 400", {}, 400, (error) => expect((error as ApiError).status).toBe(400)],
    ["HTTP 466", {}, 466, (error) => expect((error as ApiError).status).toBe(466)],
  ])("%s — an error, no chat, the number stays", async (_name, body, status, check) => {
    respondByMethod({ checkAccount: { body, status } });
    await context.start(async () => {
      credentialsAtom.set(creds);
      fill("79876543210");
      await submit();

      check(createChatForm.submit.error());
      expect(chatsAtom()).toEqual({});
      expect(activeChatIdAtom()).toBeNull();
      expect(phone()).toBe("79876543210");
    });
  });

  it("reports a failed fetch as ApiError network", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await context.start(async () => {
      credentialsAtom.set(creds);
      fill("79876543210");
      await submit();

      const error = createChatForm.submit.error();
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).kind).toBe("network");
      expect(chatsAtom()).toEqual({});
    });
  });

  it("clears the submit error once the number changes", async () => {
    respondByMethod({ checkAccount: { body: checkAccountNotExists } });
    await context.start(async () => {
      credentialsAtom.set(creds);
      fill("79876543210");
      await submit();
      expect(createChatForm.submit.error()).toBeInstanceOf(CreateChatError);

      fill("7987654321");
      expect(createChatForm.submit.error()).toBeUndefined();
    });
  });

  it("a new submit cancels the one in flight", async () => {
    fetchMock.mockImplementationOnce(
      (_, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    );
    fetchMock.mockImplementationOnce(async () => Response.json(checkAccountExists));
    await context.start(async () => {
      credentialsAtom.set(creds);
      fill("79991112233");
      const first = createChatForm.submit();
      await wrap(vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()));
      const firstSignal = fetchMock.mock.calls[0]![1]?.signal;

      fill("79876543210");
      await submit();
      const reason: unknown = await wrap(first.catch((error: unknown) => error));

      expect(isAbort(reason)).toBe(true);
      expect(firstSignal?.aborted).toBe(true);
      expect(createChatForm.submit.error()).toBeUndefined();
      expect(Object.values(chatsAtom()).map((chat) => chat.phone)).toEqual(["79876543210"]);
    });
  });

  it("submit.abort() cancels the request without an error", async () => {
    hangUntilAbort();
    await context.start(async () => {
      credentialsAtom.set(creds);
      fill("79876543210");
      const pending = createChatForm.submit();
      await wrap(vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()));

      createChatForm.submit.abort();
      const reason: unknown = await wrap(pending.catch((error: unknown) => error));

      expect(isAbort(reason)).toBe(true);
      expect(createChatForm.submit.error()).toBeUndefined();
      expect(chatsAtom()).toEqual({});
    });
  });

  it("drops a late answer after logout", async () => {
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      fill("79876543210");
      const pending = submit();
      await wrap(vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()));

      logout();
      response.resolveNext(checkAccountExists);
      await pending;

      expect(chatsAtom()).toEqual({});
      expect(activeChatIdAtom()).toBeNull();
    });
  });
});
