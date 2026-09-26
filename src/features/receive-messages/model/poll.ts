import { notifications } from "@mantine/notifications";
import { abortVar, isAbort, sleep, wrap } from "@reatom/core";

import { greenApiAtom, logout } from "@/entities/session";
import { ApiError } from "@/shared/api";

import { applyReceivedMessage } from "./apply-notification";
import { parseNotification } from "./parse-notification";
import { receiveStatusAtom } from "./status";

/** `receiveTimeout` of `receiveNotification`, seconds: the server holds the request that long. */
export const RECEIVE_TIMEOUT_S = 20;
/** Client-side timeout of one request, ms: above `RECEIVE_TIMEOUT_S` with a margin. */
export const RECEIVE_REQUEST_TIMEOUT = 30_000;
/** The longest pause between failed requests, ms. */
export const BACKOFF_MAX = 30_000;
/** Failed requests in a row after which the status becomes `reconnecting`. */
export const RECONNECTING_AFTER = 2;

export const SESSION_EXPIRED_TOAST = {
  color: "red",
  message: "Сессия недействительна, войдите заново",
};

/** Pause after the `failures`-th failed request in a row: 1 s, 2 s, 4 s… up to `BACKOFF_MAX`. */
export function backoffDelay(failures: number): number {
  return Math.min(1000 * 2 ** (failures - 1), BACKOFF_MAX);
}

/** A notification the layout throws on must not stop the FIFO queue: logged and deleted. */
function applySafely(body: unknown): void {
  try {
    const message = parseNotification(body);
    if (message) applyReceivedMessage(message);
  } catch (error) {
    console.error("receive-messages: failed to apply a notification", error);
  }
}

/**
 * Polls the notification queue until cancelled: `receiveNotification` → layout →
 * `deleteNotification` (ignored notifications are deleted too). Runs in the caller's frame and
 * stops on its `abortVar` cancellation, on logout (another client) and on `401`/`403` (toast +
 * `logout()`). Network/HTTP errors, `469` and timeouts — pauses with backoff, `reconnecting` after
 * `RECONNECTING_AFTER` failures in a row. Never rejects on cancellation.
 */
export async function pollNotifications(): Promise<void> {
  const api = greenApiAtom();
  if (!api) return;
  const { controller, unsubscribe } = abortVar.subscribe();
  const options = { signal: controller.signal, timeout: RECEIVE_REQUEST_TIMEOUT };
  let failures = 0;
  receiveStatusAtom.set("polling");
  try {
    while (true) {
      try {
        const notification = await wrap(
          api.receiveNotification({ ...options, receiveTimeout: RECEIVE_TIMEOUT_S }),
        );
        // Logout does not cancel requests in flight: drop the answer for the old session.
        if (greenApiAtom() !== api) return;
        if (notification) {
          applySafely(notification.body);
          // A failed delete returns the same notification later: the layout is idempotent.
          await wrap(api.deleteNotification(notification.receiptId, options));
          if (greenApiAtom() !== api) return;
        }
        failures = 0;
        receiveStatusAtom.set("polling");
      } catch (error) {
        if (isAbort(error) || greenApiAtom() !== api) return;
        if (error instanceof ApiError && error.kind === "auth") {
          notifications.show(SESSION_EXPIRED_TOAST);
          logout();
          return;
        }
        failures += 1;
        if (failures >= RECONNECTING_AFTER) receiveStatusAtom.set("reconnecting");
        await wrap(sleep(backoffDelay(failures)));
        if (greenApiAtom() !== api) return;
      }
    }
  } catch (error) {
    // Cancelled mid-pause (unsubscribed, logout of the frame): a silent exit.
    if (!isAbort(error)) throw error;
  } finally {
    unsubscribe();
  }
}
