import { notifications } from "@mantine/notifications";
import { action, context, notify, withAbort, wrap } from "@reatom/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { activeChatIdAtom, chatsAtom } from "@/entities/chat";
import { messagesAtom } from "@/entities/message";
import { credentialsAtom, logout } from "@/entities/session";

import { deleteNotificationResponse } from "@test/fixtures/green-api/delete-notification";
import { outgoingMessageStatus } from "@test/fixtures/green-api/ignored-notifications";
import { receiveNotificationResponse } from "@test/fixtures/green-api/receive-notification";
import {
  BASE,
  calledMethods,
  calledUrls,
  creds,
  deferFetch,
  fetchMock,
  stubFetch,
  TOKEN,
} from "@test/green-api";

import { applyReceivedMessage } from "./apply-notification";
import {
  BACKOFF_MAX,
  pollNotifications,
  RECEIVE_REQUEST_TIMEOUT,
  RECONNECTING_AFTER,
  SESSION_EXPIRED_TOAST,
} from "./poll";
import { receiveStatusAtom } from "./receive-status";

vi.mock("./apply-notification", async (importOriginal) => {
  const original = await importOriginal<typeof import("./apply-notification")>();
  return {
    ...original,
    applyReceivedMessage: vi.fn<typeof original.applyReceivedMessage>(
      original.applyReceivedMessage,
    ),
  };
});

const CHAT_ID = receiveNotificationResponse.body.senderData.chatId;
const RECEIPT_ID = receiveNotificationResponse.receiptId;
const RECEIVE_URL = `${BASE}/receiveNotification/${TOKEN}?receiveTimeout=20`;
const DELETE_URL = `${BASE}/deleteNotification/${TOKEN}/${RECEIPT_ID}`;
const ignored = { receiptId: 7, body: outgoingMessageStatus };

/** The polling in a cancellable frame, as the connect hook runs it. */
let loop: Promise<void> = Promise.resolve();
const poll = action(() => {
  loop = pollNotifications();
  return loop;
}, "test.poll").extend(withAbort("manual"));

/**
 * Starts the polling and returns the promise of `pollNotifications()` itself. The action's own
 * promise rejects on `poll.abort()` (a `withAbort` frame), so it is silenced here.
 */
function start(): Promise<void> {
  poll().catch(() => {});
  return loop;
}

/** Lets the pending promises settle without moving the fake clock. */
const flush = () => vi.advanceTimersByTimeAsync(0);

/** Cancels the polling and waits for it: `pollNotifications()` resolves on cancellation. */
async function stop(running: Promise<void>): Promise<void> {
  poll.abort();
  await wrap(running);
}

beforeEach(() => {
  stubFetch();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pollNotifications: queue", () => {
  it("does nothing without a client", async () => {
    await context.start(async () => {
      await wrap(start());
      expect(fetchMock).not.toHaveBeenCalled();
      expect(receiveStatusAtom()).toBe("idle");
    });
  });

  it("asks again at once when the queue is empty", async () => {
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      const running = start();
      await wrap(flush());
      expect(receiveStatusAtom()).toBe("polling");
      expect(calledUrls()).toEqual([RECEIVE_URL]);

      response.resolveNext(null);
      await wrap(flush());
      expect(calledMethods()).toEqual(["receiveNotification", "receiveNotification"]);
      expect(response.pending()).toBe(1);

      await wrap(stop(running));
    });
  });

  it("applies a message, deletes it by receiptId and asks for the next one", async () => {
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      const running = start();
      await wrap(flush());

      response.resolveNext(receiveNotificationResponse);
      await wrap(flush());
      expect(messagesAtom()[CHAT_ID]).toEqual([
        expect.objectContaining({
          id: receiveNotificationResponse.body.idMessage,
          text: "Привет от Green-API!",
          direction: "in",
          status: "sent",
        }),
      ]);
      expect(chatsAtom()[CHAT_ID]).toBeDefined();
      expect(activeChatIdAtom()).toBeNull();
      expect(calledUrls()).toEqual([RECEIVE_URL, DELETE_URL]);
      expect(fetchMock.mock.calls[1]![1]?.method).toBe("DELETE");

      response.resolveNext(deleteNotificationResponse);
      await wrap(flush());
      expect(calledMethods()).toEqual([
        "receiveNotification",
        "deleteNotification",
        "receiveNotification",
      ]);

      await wrap(stop(running));
    });
  });

  it("deletes an ignored notification without touching the data", async () => {
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      const running = start();
      await wrap(flush());

      response.resolveNext(ignored);
      await wrap(flush());
      expect(calledUrls()[1]).toBe(`${BASE}/deleteNotification/${TOKEN}/${ignored.receiptId}`);
      expect(messagesAtom()).toEqual({});
      expect(chatsAtom()).toEqual({});

      await wrap(stop(running));
    });
  });

  it("gets the same notification again after a failed delete, without a duplicate", async () => {
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      const running = start();
      await wrap(flush());

      response.resolveNext(receiveNotificationResponse);
      await wrap(flush());
      response.rejectNext(new TypeError("Failed to fetch"));
      await wrap(vi.advanceTimersByTimeAsync(1000));

      response.resolveNext(receiveNotificationResponse);
      await wrap(flush());
      response.resolveNext(deleteNotificationResponse);
      await wrap(flush());

      expect(calledMethods()).toEqual([
        "receiveNotification",
        "deleteNotification",
        "receiveNotification",
        "deleteNotification",
        "receiveNotification",
      ]);
      expect(messagesAtom()[CHAT_ID]).toHaveLength(1);

      await wrap(stop(running));
    });
  });

  it("deletes a notification the layout throws on and goes on", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(applyReceivedMessage).mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      const running = start();
      await wrap(flush());

      response.resolveNext(receiveNotificationResponse);
      await wrap(flush());
      expect(error).toHaveBeenCalledOnce();
      expect(calledUrls()).toEqual([RECEIVE_URL, DELETE_URL]);

      response.resolveNext(deleteNotificationResponse);
      await wrap(flush());
      expect(calledMethods().at(-1)).toBe("receiveNotification");
      expect(receiveStatusAtom()).toBe("polling");

      await wrap(stop(running));
    });
  });
});

describe("pollNotifications: errors and status", () => {
  it("backs off 1 s, 2 s, 4 s… up to BACKOFF_MAX and recovers after a success", async () => {
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      const running = start();
      await wrap(flush());

      /** Fails the pending request and checks the pause before the next one. */
      async function failAndWait(delay: number) {
        response.rejectNext(new TypeError("Failed to fetch"));
        await wrap(vi.advanceTimersByTimeAsync(delay - 1));
        expect(response.pending()).toBe(0);
        await wrap(vi.advanceTimersByTimeAsync(1));
        expect(response.pending()).toBe(1);
      }

      await wrap(failAndWait(1000));
      expect(RECONNECTING_AFTER).toBe(2);
      expect(receiveStatusAtom()).toBe("polling");
      await wrap(failAndWait(2000));
      expect(receiveStatusAtom()).toBe("reconnecting");
      await wrap(failAndWait(4000));
      await wrap(failAndWait(8000));
      await wrap(failAndWait(16_000));
      await wrap(failAndWait(BACKOFF_MAX));
      await wrap(failAndWait(BACKOFF_MAX));
      expect(receiveStatusAtom()).toBe("reconnecting");

      response.resolveNext(null);
      await wrap(flush());
      expect(receiveStatusAtom()).toBe("polling");
      // An HTTP error counts as a failure too; the pause starts over from 1 s.
      response.resolveNext({}, 500);
      await wrap(flush());
      await wrap(vi.advanceTimersByTimeAsync(999));
      expect(response.pending()).toBe(0);
      await wrap(vi.advanceTimersByTimeAsync(1));
      expect(response.pending()).toBe(1);
      expect(receiveStatusAtom()).toBe("polling");

      await wrap(stop(running));
    });
  });

  it("treats a request timeout as a failure", async () => {
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      const running = start();
      await wrap(flush());

      await wrap(vi.advanceTimersByTimeAsync(RECEIVE_REQUEST_TIMEOUT - 1));
      expect(response.pending()).toBe(1);
      await wrap(vi.advanceTimersByTimeAsync(1));
      expect(response.pending()).toBe(0);
      await wrap(vi.advanceTimersByTimeAsync(1000));
      expect(response.pending()).toBe(1);
      expect(calledMethods()).toEqual(["receiveNotification", "receiveNotification"]);

      await wrap(stop(running));
    });
  });

  it("logs out with a toast on 401 and stops", async () => {
    const show = vi.spyOn(notifications, "show");
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      const running = start();
      await wrap(flush());

      response.resolveNext({}, 401);
      await wrap(running);
      expect(credentialsAtom()).toBeNull();
      expect(show).toHaveBeenCalledWith(SESSION_EXPIRED_TOAST);

      await wrap(vi.advanceTimersByTimeAsync(BACKOFF_MAX));
      expect(calledMethods()).toEqual(["receiveNotification"]);
    });
  });

  it("stops without more requests when cancelled mid-request", async () => {
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      const running = start();
      await wrap(flush());

      await wrap(stop(running));
      expect(response.pending()).toBe(0);
      await wrap(vi.advanceTimersByTimeAsync(BACKOFF_MAX));
      expect(calledMethods()).toEqual(["receiveNotification"]);
    });
  });

  it("stops without more requests when cancelled mid-pause", async () => {
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      const running = start();
      await wrap(flush());
      response.rejectNext(new TypeError("Failed to fetch"));
      await wrap(vi.advanceTimersByTimeAsync(500));

      await wrap(stop(running));
      await wrap(vi.advanceTimersByTimeAsync(BACKOFF_MAX));
      expect(calledMethods()).toEqual(["receiveNotification"]);
    });
  });

  it("drops an answer that arrives after logout and stops", async () => {
    const response = deferFetch();
    await context.start(async () => {
      credentialsAtom.set(creds);
      const running = start();
      await wrap(flush());

      logout();
      notify();
      response.resolveNext(receiveNotificationResponse);
      await wrap(running);
      expect(messagesAtom()).toEqual({});
      expect(chatsAtom()).toEqual({});
      expect(calledMethods()).toEqual(["receiveNotification"]);
    });
  });
});
