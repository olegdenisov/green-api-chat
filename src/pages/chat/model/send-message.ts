import { abortVar, action, isAbort, reatomField, withChangeHook, wrap } from "@reatom/core";

import { activeChatAtom, activeChatIdAtom, touchChat } from "@/entities/chat";
import {
  addMessage,
  isSendingStale,
  messagesAtom,
  SEND_TIMEOUT,
  updateMessage,
} from "@/entities/message";
import { greenApiAtom } from "@/entities/session";
import type { GreenApi } from "@/shared/api";

function requireApi(caller: string): GreenApi {
  const api = greenApiAtom();
  // The chat screen is shown only with credentials.
  if (!api) throw new Error(`${caller}: no GREEN-API client (logged out)`);
  return api;
}

/**
 * One send attempt of the `sending` message `id`. Never rejects: the actions calling it are
 * not awaited, and a rejection on a frame reset would be unhandled.
 */
async function deliver(api: GreenApi, chatId: string, id: string, text: string): Promise<void> {
  const { controller, unsubscribe } = abortVar.subscribe();
  // `request()` rethrows `signal.reason` as is, and a `TimeoutError` is not an `AbortError`, so
  // a timeout ends up as a failure, not a cancellation. A plain timer instead of
  // `AbortSignal.timeout()`: the latter ignores fake timers in tests.
  const timeout = new AbortController();
  const timer = setTimeout(
    () => timeout.abort(new DOMException("The send timed out", "TimeoutError")),
    SEND_TIMEOUT,
  );
  const signal = AbortSignal.any([controller.signal, timeout.signal]);
  try {
    const { idMessage } = await wrap(api.sendMessage({ chatId, message: text }, { signal }));
    // Logout does not cancel requests in flight: drop a late answer for the old session.
    if (greenApiAtom() !== api) return;
    updateMessage(chatId, id, { id: idMessage, status: "sent" });
  } catch (error) {
    // Cancelled (a frame reset — its `wrap` rejects once the request settles): the message is
    // left as is; `isSendingStale` covers it.
    if (isAbort(error)) return;
    if (greenApiAtom() !== api) return;
    updateMessage(chatId, id, { status: "failed" });
  } finally {
    clearTimeout(timer);
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
  const api = requireApi("sendChatMessage");
  const now = Date.now();
  const id = `local-${crypto.randomUUID()}`;
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
  return deliver(api, chatId, id, text);
}, "chat.sendMessage");

/**
 * Sends a `failed` or stale `sending` message again: same text and temporary id, a new
 * `attemptAt`. Any other message — no-op. Throws synchronously without a client (a programmer
 * error, like `sendChatMessage`); otherwise never rejects.
 */
export const retryChatMessage = action((chatId: string, id: string): Promise<void> => {
  const api = requireApi("retryChatMessage");
  const now = Date.now();
  const message = messagesAtom()[chatId]?.find((item) => item.id === id);
  if (!message || message.direction !== "out") return Promise.resolve();
  if (message.status !== "failed" && !isSendingStale(message, now)) return Promise.resolve();
  updateMessage(chatId, id, { status: "sending", attemptAt: now });
  return deliver(api, chatId, id, message.text);
}, "chat.retryMessage");

/** The message input; one draft for all chats. */
export const draftField = reatomField("", "chat.draft");

/**
 * Sends the draft to the active chat and clears it right away (the send is not awaited).
 * Blank text or no active chat — nothing happens.
 */
export const sendDraft = action(() => {
  const text = draftField().trim();
  const chat = activeChatAtom();
  if (text === "" || !chat) return;
  draftField.reset();
  void sendChatMessage(chat.chatId, text);
}, "chat.sendDraft");

// The draft belongs to the chat it was typed in: switching chats (including "back" on a narrow
// screen) drops it.
activeChatIdAtom.extend(withChangeHook(() => draftField.reset()));
