import { Button, Text } from "@mantine/core";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { useEffect, useState } from "react";

import { isSendingStale, type Message, sendingStaleAt } from "@/entities/message";

import { formatTime } from "../lib/format-time";
import { retryChatMessage } from "../model/send-message";

import classes from "./message-bubble.module.css";

/**
 * A `sending` message without an answer for too long (a closed tab, a reload) is a failure.
 * Nothing else re-renders the bubble when `sendingStaleAt` passes (the request may be running in
 * another tab or gone), so a one-shot timer moves `now` past that moment.
 */
function useFailed(message: Message): boolean {
  const [now, setNow] = useState(Date.now);
  const sending = message.direction === "out" && message.status === "sending";
  const staleAt = sendingStaleAt(message);

  useEffect(() => {
    if (!sending || now > staleAt) return;
    // `isSendingStale` is strict (`>`): one extra millisecond. A timer that fires early sets
    // `now` all the same, and the effect schedules the next one.
    const timer = setTimeout(() => setNow(Date.now()), staleAt - Date.now() + 1);
    return () => clearTimeout(timer);
  }, [sending, staleAt, now]);

  return message.status === "failed" || isSendingStale(message, now);
}

/** Status of an outgoing message: «…» sending, «✓» sent, otherwise «Не отправлено · Повторить». */
const OutgoingStatus = reatomComponent(
  ({ message, failed }: { message: Message; failed: boolean }) => {
    if (failed) {
      return (
        <span>
          Не отправлено ·{" "}
          <Button
            variant="transparent"
            color="red"
            size="compact-xs"
            className={classes.retry}
            onClick={wrap(() => void retryChatMessage(message.chatId, message.id))}
          >
            Повторить
          </Button>
        </span>
      );
    }
    if (message.status === "sending")
      return (
        <span role="img" aria-label="Отправляется">
          …
        </span>
      );
    return (
      <span role="img" aria-label="Отправлено">
        ✓
      </span>
    );
  },
  "chatPage.OutgoingStatus",
);

/** One message: outgoing on the right, incoming on the left; text, `HH:MM` and the status. */
export function MessageBubble({ message }: { message: Message }) {
  const outgoing = message.direction === "out";
  const failed = useFailed(message);
  return (
    <div className={classes.row} data-direction={message.direction} data-message-id={message.id}>
      <div className={classes.bubble} data-failed={failed || undefined}>
        <Text size="sm" className={classes.text}>
          {message.text}
        </Text>
        <span className={classes.meta}>
          <time dateTime={new Date(message.timestamp).toISOString()}>
            {formatTime(message.timestamp)}
          </time>
          {outgoing && <OutgoingStatus message={message} failed={failed} />}
        </span>
      </div>
    </div>
  );
}
