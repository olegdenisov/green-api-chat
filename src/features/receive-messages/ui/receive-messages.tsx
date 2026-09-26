import { reatomComponent } from "@reatom/react";

import { receiveStatusAtom } from "../model/receive-status";

/**
 * Headless: subscribes to `receiveStatusAtom` while the chat screen (credentials) is shown,
 * so the polling lifetime is tied to the logged-in screen, not to the indicator.
 */
export const ReceiveMessages = reatomComponent(() => {
  receiveStatusAtom();
  return null;
}, "receiveMessages.ReceiveMessages");
