import { action, atom, withLocalStorage } from "@reatom/core";

import type { Credentials } from "@/shared/api";

/** Instance credentials; `null` — logged out. Saved only after a successful login. */
export const credentialsAtom = atom<Credentials | null>(null, "session.credentials").extend(
  withLocalStorage("ga.credentials"),
);

export const logout = action(() => {
  credentialsAtom.set(null);
}, "session.logout");
