import { Loader, Text } from "@mantine/core";
import { reatomComponent } from "@reatom/react";

import { receiveStatusAtom } from "../model/receive-status";

import classes from "./connection-indicator.module.css";

/** «Соединение…» strip, shown only while the leader tab keeps failing to poll. */
export const ConnectionIndicator = reatomComponent(() => {
  if (receiveStatusAtom() !== "reconnecting") return null;
  return (
    <div className={classes.indicator} role="status">
      <Loader size="xs" color="gray" />
      <Text size="sm">Соединение…</Text>
    </div>
  );
}, "receiveMessages.ConnectionIndicator");
