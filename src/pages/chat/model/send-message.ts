import { abortVar, action, isAbort, wrap } from "@reatom/core";

import { touchChat } from "@/entities/chat";
import {
  addMessage,
  isSendingStale,
  messagesAtom,
  SEND_TIMEOUT,
  updateMessage,
} from "@/entities/message";
import { greenApiAtom, requireApi } from "@/entities/session";
import type { GreenApi } from "@/shared/api";

/** `crypto.randomUUID()` exists only in secure contexts (HTTPS, localhost). */
function localId(): string {
  const unique =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `local-${unique}`;
}

type Attempt = { api: GreenApi; chatId: string; id: string; text: string; attemptAt: number };

/**
 * The message is still waiting for this attempt: not deleted, not sent under a new id, and not
 * retried since (a late timer of an older attempt must not overwrite a newer one).
 */
function isCurrent({ api, chatId, id, attemptAt }: Attempt): boolean {
  if (greenApiAtom() !== api) return false;
  const message = messagesAtom()[chatId]?.find((item) => item.id === id);
  return message?.attemptAt === attemptAt;
}

/**
 * One send attempt of the `sending` message `id`. Never rejects: the actions calling it are
 * not awaited, and a rejection on a frame reset would be unhandled.
 */
async function deliver(attempt: Attempt): Promise<void> {
  const { api, chatId, id, text } = attempt;
  const { controller, unsubscribe } = abortVar.subscribe();
  // One controller for both the `abortVar` cancellation and the timeout, without
  // `AbortSignal.any()`: it is missing in Safari < 17.4 and Chrome < 116, which Vite's default
  // target still covers (Vite adds no polyfills). `request()` rethrows `signal.reason` as is,
  // and a `TimeoutError` is not an `AbortError`, so a timeout ends up as a failure, not a
  // cancellation. A plain timer instead of `AbortSignal.timeout()`: the latter ignores fake
  // timers in tests.
  const combined = new AbortController();
  const onAbort = () => combined.abort(controller.signal.reason);
  if (controller.signal.aborted) onAbort();
  else controller.signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(
    () => combined.abort(new DOMException("The send timed out", "TimeoutError")),
    SEND_TIMEOUT,
  );
  const { signal } = combined;
  try {
    const { idMessage } = await wrap(api.sendMessage({ chatId, message: text }, { signal }));
    // Logout does not cancel requests in flight: drop a late answer for the old session.
    if (!isCurrent(attempt)) return;
    // No `idMessage` in a 200 (not per the docs): keep the local id, it is still unique.
    const sentId = typeof idMessage === "string" && idMessage !== "" ? idMessage : id;
    updateMessage(chatId, id, { id: sentId, status: "sent" });
  } catch (error) {
    // Cancelled through `abortVar`: the message is left as is; `isSendingStale` covers it. A
    // frame reset cancels neither the request nor the timer — the attempt ends by the timeout.
    if (isAbort(error)) return;
    if (!isCurrent(attempt)) return;
    updateMessage(chatId, id, { status: "failed" });
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", onAbort);
    unsubscribe();
  }
}

/**
 * Sends a text message: it shows up at once as `sending`, then becomes `sent` (with the
 * `idMessage`) or `failed`. A plain action, not a form submit: switching chats, a new send or
 * unmounting the window do not cancel it. Resolves when the attempt settles, never rejects;
 * throws synchronously only without a client (a programmer error: the screen needs creds).
 */
export const sendChatMessage = action((chatId: string, text: string): Promise<void> => {
  const api = requireApi();
  const now = Date.now();
  const id = localId();
  addMessage({
    id,
    chatId,
    text,
    direction: "out",
    status: "sending",
    timestamp: now,
    attemptAt: now,
  });
  touchChat(chatId, now);
  return deliver({ api, chatId, id, text, attemptAt: now });
}, "chatPage.sendMessage");

/**
 * Sends a `failed` or stale `sending` message again: same text and temporary id, a new
 * `attemptAt`. Any other message — no-op. Throws synchronously without a client (a programmer
 * error, like `sendChatMessage`); otherwise never rejects.
 */
export const retryChatMessage = action((chatId: string, id: string): Promise<void> => {
  const api = requireApi();
  const now = Date.now();
  const message = messagesAtom()[chatId]?.find((item) => item.id === id);
  // The direction is checked for `failed` too: stored data is only shape-checked, so an
  // incoming `failed` message is possible there.
  if (!message || message.direction !== "out") return Promise.resolve();
  if (message.status !== "failed" && !isSendingStale(message, now)) return Promise.resolve();
  updateMessage(chatId, id, { status: "sending", attemptAt: now });
  return deliver({ api, chatId, id, text: message.text, attemptAt: now });
}, "chatPage.retryMessage");
