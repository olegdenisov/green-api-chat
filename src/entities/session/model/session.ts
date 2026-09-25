import { action, atom, withLocalStorage } from "@reatom/core";

import type { Credentials } from "@/shared/api";

/**
 * Lifetime of the stored record. The default (`MAX_SAFE_TIMEOUT`, ~24.8 days) would log the
 * user out silently; the credentials must stay until "Выйти". A finite number, not
 * `Infinity`: `JSON.stringify` turns it into `null`, and such a record counts as expired.
 */
const CREDENTIALS_TTL = 10 * 365 * 24 * 60 * 60 * 1000;

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
  withLocalStorage({ key: "ga.credentials", time: CREDENTIALS_TTL, fromSnapshot: toCredentials }),
);

export const logout = action(() => {
  credentialsAtom.set(null);
}, "session.logout");
