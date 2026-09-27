// https://green-api.com/telegram/docs/api/receiving/notifications-format/statuses/OutgoingMessageStatus/
// The doc examples verbatim: only `delivered`/`read` carry `idMessage`.
import type { OutgoingMessageStatusNotification } from "@/shared/api";

export const outgoingMessageStatusDelivered = {
  typeWebhook: "outgoingMessageStatus",
  chatId: "10000000",
  instanceData: {
    idInstance: 4100000000,
    wid: "79876543210@c.us",
    typeInstance: "telegram",
  },
  timestamp: 1755591519,
  idMessage: "115054445839974415",
  status: "delivered",
} satisfies OutgoingMessageStatusNotification;

export const outgoingMessageStatusRead = {
  typeWebhook: "outgoingMessageStatus",
  chatId: "10000000",
  instanceData: {
    idInstance: 4100000000,
    wid: "79876543210@c.us",
    typeInstance: "telegram",
  },
  timestamp: 1755591519,
  idMessage: "115054445839974415",
  status: "read",
} satisfies OutgoingMessageStatusNotification;

/** No `idMessage`: the message it belongs to cannot be found. */
export const outgoingMessageStatusFailed = {
  typeWebhook: "outgoingMessageStatus",
  chatId: "10000000",
  instanceData: {
    idInstance: 4100000000,
    wid: "79876543210@c.us",
    typeInstance: "telegram",
  },
  timestamp: 1755591519,
  status: "failed",
  description: "media caption too long",
} satisfies OutgoingMessageStatusNotification;

/** No `idMessage`; the doc example has a WhatsApp-style `chatId`. */
export const outgoingMessageStatusNoAccount = {
  typeWebhook: "outgoingMessageStatus",
  chatId: "77777777777@c.us",
  instanceData: {
    idInstance: 4100000000,
    wid: "79876543210@c.us",
    typeInstance: "telegram",
  },
  timestamp: 1755591519,
  status: "noAccount",
} satisfies OutgoingMessageStatusNotification;
