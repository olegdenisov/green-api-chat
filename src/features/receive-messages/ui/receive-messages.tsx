import { reatomComponent } from "@reatom/react";

import { pollingAtom } from "../model/polling";

/**
 * Headless: subscribes to `pollingAtom` while the chat screen (credentials) is shown, so the
 * polling lifetime is tied to the logged-in screen, not to the indicator.
 */
export const ReceiveMessages = reatomComponent(() => {
  pollingAtom();
  return null;
}, "receiveMessages.ReceiveMessages");
