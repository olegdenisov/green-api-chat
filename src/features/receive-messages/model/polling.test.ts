import { notifications } from "@mantine/notifications";
import { context } from "@reatom/core";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { credentialsAtom } from "@/entities/session";

import { calledMethods, creds, deferFetch, fetchMock, stubFetch } from "@test/green-api";
import { stubWebLocks } from "@test/web-locks";

import { POLLING_LOCK, pollingAtom } from "./polling";
import { receiveStatusAtom } from "./status";

/** Lets the pending promises settle without moving the fake clock. */
const flush = () => vi.advanceTimersByTimeAsync(0);

/** A new frame (a tab) with credentials, subscribed to the status; returns its unsubscribe. */
function openTab() {
  const frame = context.start();
  const unsubscribe = frame.run(() => {
    credentialsAtom.set(creds);
    return pollingAtom.subscribe(() => {});
  });
  return { status: () => frame.run(() => receiveStatusAtom()), unsubscribe };
}

beforeEach(() => {
  stubFetch();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pollingAtom: polling lifecycle", () => {
  it("starts polling under the lock on subscribe and stops on unsubscribe", async () => {
    const locks = stubWebLocks();
    const response = deferFetch();
    const tab = openTab();
    await flush();

    expect(tab.status()).toBe("polling");
    expect(locks.held(POLLING_LOCK)).toBe(true);
    expect(calledMethods()).toEqual(["receiveNotification"]);

    tab.unsubscribe();
    await flush();
    expect(tab.status()).toBe("idle");
    expect(response.pending()).toBe(0);
    expect(locks.held(POLLING_LOCK)).toBe(false);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("polls in one tab only, the other waits as a follower", async () => {
    const locks = stubWebLocks();
    const response = deferFetch();
    const leader = openTab();
    await flush();
    const follower = openTab();
    await flush();

    expect(leader.status()).toBe("polling");
    expect(follower.status()).toBe("follower");
    expect(locks.waiting(POLLING_LOCK)).toBe(1);
    expect(response.pending()).toBe(1);

    leader.unsubscribe();
    follower.unsubscribe();
    await flush();
    expect(locks.held(POLLING_LOCK)).toBe(false);
    expect(locks.waiting(POLLING_LOCK)).toBe(0);
  });

  it("hands the lock and the polling over when the leader unsubscribes", async () => {
    const locks = stubWebLocks();
    const response = deferFetch();
    const leader = openTab();
    await flush();
    const follower = openTab();
    await flush();

    leader.unsubscribe();
    await flush();
    expect(leader.status()).toBe("idle");
    expect(follower.status()).toBe("polling");
    expect(locks.held(POLLING_LOCK)).toBe(true);
    expect(calledMethods()).toEqual(["receiveNotification", "receiveNotification"]);
    expect(response.pending()).toBe(1);

    follower.unsubscribe();
    await flush();
    expect(response.pending()).toBe(0);
    expect(locks.held(POLLING_LOCK)).toBe(false);
  });

  it("releases the wait for the lock when a follower unsubscribes", async () => {
    const locks = stubWebLocks();
    deferFetch();
    const leader = openTab();
    await flush();
    const follower = openTab();
    await flush();

    follower.unsubscribe();
    await flush();
    expect(follower.status()).toBe("idle");
    expect(locks.waiting(POLLING_LOCK)).toBe(0);
    expect(leader.status()).toBe("polling");

    leader.unsubscribe();
    await flush();
  });

  it("does not start two loops on connect → disconnect → connect (StrictMode)", async () => {
    const locks = stubWebLocks();
    const response = deferFetch();
    const frame = context.start();
    const unsubscribe = frame.run(() => {
      credentialsAtom.set(creds);
      pollingAtom.subscribe(() => {})();
      return pollingAtom.subscribe(() => {});
    });
    await flush();

    expect(frame.run(() => receiveStatusAtom())).toBe("polling");
    expect(response.pending()).toBe(1);
    expect(locks.waiting(POLLING_LOCK)).toBe(0);

    unsubscribe();
    await flush();
    expect(response.pending()).toBe(0);
    expect(locks.held(POLLING_LOCK)).toBe(false);
  });

  it("a cancelled loop ending late does not overwrite the status of the next one", async () => {
    const response = deferFetch();
    const frame = context.start();
    const unsubscribe = frame.run(() => {
      credentialsAtom.set(creds);
      return pollingAtom.subscribe(() => {});
    });
    await flush();

    // Reconnect before the first loop has settled its cancellation.
    unsubscribe();
    const resubscribe = frame.run(() => pollingAtom.subscribe(() => {}));
    await flush();
    expect(frame.run(() => receiveStatusAtom())).toBe("polling");
    expect(response.pending()).toBe(1);

    resubscribe();
    await flush();
  });

  it("polls without navigator.locks", async () => {
    expect("locks" in navigator).toBe(false);
    const response = deferFetch();
    const tab = openTab();
    await flush();

    expect(tab.status()).toBe("polling");
    expect(response.pending()).toBe(1);

    tab.unsubscribe();
    await flush();
    expect(tab.status()).toBe("idle");
    expect(response.pending()).toBe(0);
  });

  it("does not poll without credentials", async () => {
    const locks = stubWebLocks();
    const frame = context.start();
    const unsubscribe = frame.run(() => pollingAtom.subscribe(() => {}));
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    // The loop ended at once: not `follower` — nothing waits or polls.
    expect(frame.run(() => receiveStatusAtom())).toBe("idle");
    expect(locks.held(POLLING_LOCK)).toBe(false);

    unsubscribe();
    await flush();
    expect(frame.run(() => receiveStatusAtom())).toBe("idle");
  });

  it.each([
    ["with navigator.locks", true],
    ["without navigator.locks", false],
  ])("is idle after a 401 ends the loop while subscribed (%s)", async (_, withLocks) => {
    vi.spyOn(notifications, "show");
    const error = vi.spyOn(console, "error");
    const locks = withLocks ? stubWebLocks() : undefined;
    const response = deferFetch();
    const tab = openTab();
    await flush();

    response.resolveNext({}, 401);
    await flush();
    expect(tab.status()).toBe("idle");
    expect(locks?.held(POLLING_LOCK) ?? false).toBe(false);
    expect(error).not.toHaveBeenCalled();
    expect(calledMethods()).toEqual(["receiveNotification"]);

    tab.unsubscribe();
  });

  it("logs an unexpected failure of the lock request instead of an unhandled rejection", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("locks are broken");
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: () => Promise.reject(failure) },
    });
    onTestFinished(() => {
      delete (navigator as { locks?: unknown }).locks;
    });
    const tab = openTab();
    await flush();

    expect(error).toHaveBeenCalledWith("receive-messages: the polling stopped", failure);
    expect(tab.status()).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();

    tab.unsubscribe();
  });
});
