import { withChangeHook, withInitHook } from "@reatom/core";

import { credentialsAtom } from "@/entities/session";
import { deleteAllChats } from "@/features/delete-chats";
import { resetChatPage } from "@/pages/chat";

// Logout wipes the user's chats and messages. Entities do not know about each other, so the
// link lives here, in `app`: any logout — the button now, `401` from polling later, a logout in
// another tab (the `storage` event syncs the credentials) — clears the data with no extra calls.
// The chat page's inputs (the new-chat form, the draft) are reset too.
// The hooks run in the frame where the credentials changed, in the hooks phase (not
// synchronously inside `logout`). The module creates no atoms, only extensions, so its import
// order relative to the logger does not matter.
credentialsAtom.extend(
  withChangeHook((state, prevState) => {
    if (state === null && prevState) {
      deleteAllChats();
      resetChatPage();
    }
  }),
  // No credentials on start (the record expired or failed the shape check, the key was removed
  // by hand) — the data left from the last session belongs to nobody: drop it too, or the next
  // login, maybe to another instance, would see it.
  withInitHook((state) => {
    if (state === null) deleteAllChats();
  }),
);
