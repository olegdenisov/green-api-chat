import { atom } from "@reatom/core";

/**
 * - `idle` — nothing polls in this tab (no subscribers, or the loop ended: logout, `401`);
 * - `follower` — waits for the lock (another tab polls);
 * - `polling` — the leader, requests go;
 * - `reconnecting` — the leader after a series of failed requests.
 */
export type ReceiveStatus = "idle" | "follower" | "polling" | "reconnecting";

/**
 * Status of the notification queue polling in this tab. A plain atom: reading it does not
 * start the polling (that is `pollingAtom`), so the indicator does not own the lifecycle.
 * Written only by the polling (`polling.ts`, `poll.ts`).
 */
export const receiveStatusAtom = atom<ReceiveStatus>("idle", "receiveMessages.status");
