import { withChangeHook } from "@reatom/core";

import { credentialsAtom } from "@/entities/session";
import { deleteAllChats } from "@/features/delete-chats";

// Logout wipes the user's chats and messages. Entities do not know about each other, so the
// link lives here, in `app`: any logout — the button now, `401` from polling later, a logout in
// another tab (the `storage` event syncs the credentials) — clears the data with no extra calls.
// The hook runs in the frame where the credentials changed, in the hooks phase (not
// synchronously inside `logout`). The module creates no atoms, only an extension, so its import
// order relative to the logger does not matter.
credentialsAtom.extend(
  withChangeHook((state, prevState) => {
    if (state === null && prevState) deleteAllChats();
  }),
);
