import { action, atom } from "@reatom/core";

/**
 * - `idle` — no subscribers, nothing polls;
 * - `follower` — waits for the lock (another tab polls);
 * - `polling` — the leader, requests go;
 * - `reconnecting` — the leader after a series of failed requests.
 */
export type ReceiveStatus = "idle" | "follower" | "polling" | "reconnecting";

/** Status of the notification queue polling in this tab. */
export const receiveStatusAtom = atom<ReceiveStatus>("idle", "receiveMessages.status");

/** The only writer of `receiveStatusAtom`. */
export const setReceiveStatus = action((status: ReceiveStatus) => {
  receiveStatusAtom.set(status);
}, "receiveMessages.setStatus");
