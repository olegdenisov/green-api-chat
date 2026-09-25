import { action, atom, computed, withLocalStorage } from "@reatom/core";

import { createGreenApi, type Credentials, type GreenApi } from "@/shared/api";
import { PERSIST_TTL } from "@/shared/config";

/** The stored value is not validated by the storage: anything but full credentials → `null`. */
function toCredentials(snapshot: unknown): Credentials | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const { idInstance, apiTokenInstance, apiUrl } = snapshot as Partial<Record<string, unknown>>;
  if (!isFilled(idInstance) || !isFilled(apiTokenInstance) || !isFilled(apiUrl)) return null;
  return { idInstance, apiTokenInstance, apiUrl };
}

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/** Instance credentials; `null` — logged out. Saved only after a successful login. */
export const credentialsAtom = atom<Credentials | null>(null, "session.credentials").extend(
  withLocalStorage({ key: "ga.credentials", time: PERSIST_TTL, fromSnapshot: toCredentials }),
);

/** GREEN-API client for the current credentials; `null` — logged out. New credentials → new client. */
export const greenApiAtom = computed((): GreenApi | null => {
  const creds = credentialsAtom();
  return creds ? createGreenApi(creds) : null;
}, "session.greenApi");

/**
 * The current GREEN-API client. Throws without credentials: screens that send requests are
 * shown only with them, so a call while logged out is a programmer error.
 */
export function requireApi(): GreenApi {
  const api = greenApiAtom();
  if (!api) throw new Error("No GREEN-API client (logged out)");
  return api;
}

export const logout = action(() => {
  credentialsAtom.set(null);
}, "session.logout");
