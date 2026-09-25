import { Button, Text } from "@mantine/core";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";

import { isSendingStale, type Message } from "@/entities/message";

import { formatTime } from "../lib/format-time";
import { retryChatMessage } from "../model/send-message";

import classes from "./message-bubble.module.css";

/** Status of an outgoing message: «…» sending, «✓» sent, otherwise «Не отправлено · Повторить». */
const OutgoingStatus = reatomComponent(({ message }: { message: Message }) => {
  // A `sending` message without an answer for too long (a closed tab, a reload) is a failure.
  if (message.status === "failed" || isSendingStale(message, Date.now())) {
    return (
      <span className={classes.failed}>
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
  if (message.status === "sending") return <span aria-label="Отправляется">…</span>;
  return <span aria-label="Отправлено">✓</span>;
}, "chat.OutgoingStatus");

/** One message: outgoing on the right, incoming on the left; text, `HH:MM` and the status. */
export function MessageBubble({ message }: { message: Message }) {
  const outgoing = message.direction === "out";
  return (
    <div className={classes.row} data-direction={message.direction}>
      <div className={classes.bubble} data-failed={message.status === "failed" || undefined}>
        <Text size="sm" className={classes.text}>
          {message.text}
        </Text>
        <span className={classes.meta}>
          <time dateTime={new Date(message.timestamp).toISOString()}>
            {formatTime(message.timestamp)}
          </time>
          {outgoing && <OutgoingStatus message={message} />}
        </span>
      </div>
    </div>
  );
}
