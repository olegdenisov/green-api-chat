import { abortVar, action, atom, isAbort, withConnectHook, wrap } from "@reatom/core";

import { pollNotifications } from "./poll";

/**
 * - `idle` — no subscribers, nothing polls;
 * - `follower` — waits for the lock (another tab polls);
 * - `polling` — the leader, requests go;
 * - `reconnecting` — the leader after a series of failed requests.
 */
export type ReceiveStatus = "idle" | "follower" | "polling" | "reconnecting";

/** Web Lock held by the tab that polls the notification queue (the leader). */
export const POLLING_LOCK = "ga.polling";

/**
 * Leader election and the polling loop, in the connect hook's frame: disconnect cancels the
 * wait for the lock, the loop's `wrap`/`sleep` and requests. Once granted, the lock's own
 * `signal` no longer applies — the callback returns because `pollNotifications()` stops on the
 * same cancellation, and the lock goes to the next tab. Without `navigator.locks` (old
 * browsers, jsdom) every tab polls by itself.
 */
async function lead(): Promise<void> {
  const { controller, unsubscribe } = abortVar.subscribe();
  try {
    if (!("locks" in navigator)) {
      await pollNotifications();
      return;
    }
    setReceiveStatus("follower");
    await wrap(
      navigator.locks.request(
        POLLING_LOCK,
        { signal: controller.signal },
        // Called by the browser outside the frame.
        wrap(() => pollNotifications()),
      ),
    );
  } catch (error) {
    // Unsubscribed while waiting for the lock (or in the loop): a silent exit. Anything else is
    // a bug: nobody awaits the hook, so it is logged instead of an unhandled rejection.
    if (!isAbort(error)) console.error("receive-messages: the polling stopped", error);
  } finally {
    unsubscribe();
  }
}

/** Status of the notification queue polling in this tab; subscribing starts the polling. */
export const receiveStatusAtom = atom<ReceiveStatus>("idle", "receiveMessages.status").extend(
  withConnectHook(() => {
    void lead();
    return () => setReceiveStatus("idle");
  }),
);

/** The only writer of `receiveStatusAtom`. */
export const setReceiveStatus = action((status: ReceiveStatus) => {
  receiveStatusAtom.set(status);
}, "receiveMessages.setStatus");
