import { abortVar, atom, isAbort, withConnectHook, wrap } from "@reatom/core";

import { pollNotifications } from "./poll";
import { receiveStatusAtom } from "./status";

/** Web Lock held by the tab that polls the notification queue (the leader). */
export const POLLING_LOCK = "ga.polling";

/**
 * Leader election and the polling loop, in the connect hook's frame: disconnect cancels the
 * wait for the lock, the loop's `wrap`/`sleep` and requests. Once granted, the lock's own
 * `signal` no longer applies — the callback returns because `pollNotifications()` stops on the
 * same cancellation, and the lock goes to the next tab. Without `navigator.locks` (old
 * browsers, jsdom) every tab polls by itself. A loop that ends by itself (no credentials,
 * logout, `401`) leaves the status `idle`: nothing polls in this tab any more.
 */
async function lead(): Promise<void> {
  const { controller, unsubscribe } = abortVar.subscribe();
  try {
    if (!("locks" in navigator)) {
      await wrap(pollNotifications());
    } else {
      receiveStatusAtom.set("follower");
      await wrap(
        navigator.locks.request(
          POLLING_LOCK,
          { signal: controller.signal },
          // Called by the browser outside the frame.
          wrap(() => pollNotifications()),
        ),
      );
    }
    // Reached only when the loop ended by itself: on cancellation `wrap` rejects (catch below),
    // so a late old loop never overwrites the status of a new connect.
    receiveStatusAtom.set("idle");
  } catch (error) {
    // Unsubscribed while waiting for the lock (or in the loop): a silent exit. Anything else is
    // a bug: nobody awaits the hook, so it is logged instead of an unhandled rejection.
    if (!isAbort(error)) {
      console.error("receive-messages: the polling stopped", error);
      receiveStatusAtom.set("idle");
    }
  } finally {
    unsubscribe();
  }
}

/**
 * Polling lifecycle: subscribing starts the polling (the leader election and the loop),
 * the last unsubscribe stops it. The value carries nothing; the status is `receiveStatusAtom`.
 */
export const pollingAtom = atom(null, "receiveMessages.polling").extend(
  withConnectHook(() => {
    void lead();
    return () => receiveStatusAtom.set("idle");
  }),
);
