import { Button, Text } from "@mantine/core";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { useEffect, useState } from "react";

import { isSendingStale, type Message, sendingStaleAt } from "@/entities/message";
import { IconCheck, IconChecks, IconClock, IconRotateCcw } from "@/shared/ui";

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

/** Name, icon and class of each non-failed status; `failed` is rendered separately. */
const STATUS_VIEW: Record<
  Exclude<Message["status"], "failed">,
  [label: string, Icon: typeof IconCheck, className?: string]
> = {
  sending: ["Отправляется", IconClock],
  sent: ["Отправлено", IconCheck],
  delivered: ["Доставлено", IconChecks],
  read: ["Прочитано", IconChecks, classes.statusRead],
};

/**
 * Status of an outgoing message: a clock sending, a check sent, a double check delivered, a
 * double check in --ga-status-read read; a failed one — the text «Не отправлено» and a
 * «Повторить» pill.
 */
const OutgoingStatus = reatomComponent(
  ({ message, failed }: { message: Message; failed: boolean }) => {
    // `failed` already covers the `failed` status; the check narrows the type for `STATUS_VIEW`.
    if (failed || message.status === "failed") {
      return (
        <span className={classes.failed}>
          <span className={classes.failedText}>Не отправлено</span>
          <Button
            variant="transparent"
            size="compact-xs"
            leftSection={<IconRotateCcw size={12} />}
            className={classes.retry}
            onClick={wrap(() => void retryChatMessage(message.chatId, message.id))}
          >
            Повторить
          </Button>
        </span>
      );
    }
    const [label, Icon, className] = STATUS_VIEW[message.status];
    return (
      <span role="img" aria-label={label} className={className} data-status={message.status}>
        <Icon size={14} />
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
