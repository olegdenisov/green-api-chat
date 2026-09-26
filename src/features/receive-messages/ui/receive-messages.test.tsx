import { context } from "@reatom/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { credentialsAtom } from "@/entities/session";

import { calledMethods, creds, deferFetch, stubFetch } from "@test/green-api";
import { render } from "@test/render";
import { stubWebLocks } from "@test/web-locks";

import { POLLING_LOCK } from "../model/polling";
import { receiveStatusAtom } from "../model/status";
import { ReceiveMessages } from "./receive-messages";

/** Lets the pending promises settle without moving the fake clock. */
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  stubFetch();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ReceiveMessages", () => {
  it("runs one polling loop under StrictMode and stops it on unmount", async () => {
    const locks = stubWebLocks();
    const response = deferFetch();
    // Logged in before the first render: the credentials come from the persisted storage.
    context.start(() => credentialsAtom.set(creds));
    const { frame, unmount } = render(<ReceiveMessages />);
    await flush();

    expect(frame.run(() => receiveStatusAtom())).toBe("polling");
    expect(calledMethods()).toEqual(["receiveNotification"]);
    expect(response.pending()).toBe(1);
    expect(locks.waiting(POLLING_LOCK)).toBe(0);

    unmount();
    await flush();
    expect(frame.run(() => receiveStatusAtom())).toBe("idle");
    expect(response.pending()).toBe(0);
    expect(locks.held(POLLING_LOCK)).toBe(false);
  });
});
