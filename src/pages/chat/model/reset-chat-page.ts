import { action } from "@reatom/core";

import { createChatForm } from "./create-chat";
import { draftField } from "./draft";

/**
 * Drops the page's in-memory input: the new-chat form (its number, error and a request in
 * flight — `reset()` cancels the submit) and the draft. Called on logout, so the next session
 * does not inherit them.
 */
export const resetChatPage = action(() => {
  createChatForm.reset();
  draftField.reset();
}, "chatPage.resetPage");
