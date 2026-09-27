import { Text } from "@mantine/core";
import { reatomComponent } from "@reatom/react";

import { IconWifi } from "@/shared/ui";

import { receiveStatusAtom } from "../model/status";

import classes from "./connection-indicator.module.css";

/**
 * «Переподключение…» pill, shown only while the leader tab keeps failing to poll. Reads the
 * plain status atom: rendering it does not start the polling.
 */
export const ConnectionIndicator = reatomComponent(() => {
  if (receiveStatusAtom() !== "reconnecting") return null;
  return (
    <div className={classes.indicator} role="status">
      <IconWifi size={16} />
      <Text size="sm" fw={600}>
        Переподключение…
      </Text>
    </div>
  );
}, "receiveMessages.ConnectionIndicator");
