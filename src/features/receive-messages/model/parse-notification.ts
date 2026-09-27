import type {
  IncomingMessageNotification,
  MessageData,
  Notification,
  OutgoingMessageNotification,
  OutgoingMessageStatusNotification,
} from "@/shared/api";

/** A text message from the notification queue, ready to be put into a chat. */
export type ReceivedMessage = {
  kind: "message";
  chatId: string;
  /** `senderData.chatName` when it is a non-empty string. */
  chatName?: string;
  /** `idMessage`. */
  id: string;
  text: string;
  direction: "in" | "out";
  /** `true` only for `outgoingAPIMessageReceived` (sent via API, possibly by this app). */
  viaApi: boolean;
  /** Milliseconds. */
  timestamp: number;
};

/** A delivery status of an outgoing message, addressed by its `idMessage`. */
export type ReceivedStatus = {
  kind: "status";
  chatId: string;
  /** `idMessage` of the sent message. */
  id: string;
  status: "delivered" | "read";
};

export type ParsedNotification = ReceivedMessage | ReceivedStatus;

/** Private chat id: a positive integer as a string (groups are negative). */
const PRIVATE_CHAT_ID = /^[1-9]\d*$/;

/**
 * The body comes from the network: the types describe the documented shape, but any field
 * may be missing, so every value is read as possibly absent.
 */
type Loose<T> = { [K in keyof T]?: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readText = (messageData: Loose<MessageData>): string | null => {
  const typeMessage = messageData.typeMessage as MessageData["typeMessage"];
  switch (typeMessage) {
    case "textMessage": {
      const data = (messageData as Loose<Extract<MessageData, { typeMessage: "textMessage" }>>)
        .textMessageData;
      return isRecord(data) && typeof data.textMessage === "string" ? data.textMessage : null;
    }
    case "extendedTextMessage": {
      const data = (
        messageData as Loose<Extract<MessageData, { typeMessage: "extendedTextMessage" }>>
      ).extendedTextMessageData;
      return isRecord(data) && typeof data.text === "string" ? data.text : null;
    }
    default:
      // Media and other kinds are not supported.
      return null;
  }
};

type MessageNotification = IncomingMessageNotification | OutgoingMessageNotification;

function parseMessage(
  notification: Loose<MessageNotification>,
  direction: ReceivedMessage["direction"],
  viaApi: boolean,
): ReceivedMessage | null {
  const { idMessage, timestamp, senderData, messageData } = notification;
  if (typeof idMessage !== "string" || idMessage === "") return null;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  if (!isRecord(senderData) || !isRecord(messageData)) return null;

  const { chatId, chatType, chatName } = senderData;
  if (typeof chatId !== "string" || !PRIVATE_CHAT_ID.test(chatId)) return null;
  if (chatType !== undefined && chatType !== "user") return null;

  const text = readText(messageData);
  if (text === null) return null;

  return {
    kind: "message",
    chatId,
    ...(typeof chatName === "string" && chatName !== "" && { chatName }),
    id: idMessage,
    text,
    direction,
    viaApi,
    timestamp: timestamp * 1000,
  };
}

/**
 * Only `delivered`/`read` of a private chat: `failed`/`noAccount` have no `idMessage` in the
 * docs, so there is no message to put them on.
 */
function parseStatus(
  notification: Loose<OutgoingMessageStatusNotification>,
): ReceivedStatus | null {
  const { chatId, idMessage, status } = notification;
  if (status !== "delivered" && status !== "read") return null;
  if (typeof idMessage !== "string" || idMessage === "") return null;
  if (typeof chatId !== "string" || !PRIVATE_CHAT_ID.test(chatId)) return null;
  return { kind: "status", chatId, id: idMessage, status };
}

/**
 * Turns a notification body into a text message of a private chat or a delivery status of an
 * outgoing message. Everything else (other statuses, instance state, media, groups, malformed
 * bodies) yields `null`. Pure, never throws.
 */
export function parseNotification(body: unknown): ParsedNotification | null {
  if (!isRecord(body)) return null;
  const typeWebhook = (body as Loose<Notification>).typeWebhook as Notification["typeWebhook"];
  switch (typeWebhook) {
    case "incomingMessageReceived":
      return parseMessage(body as Loose<MessageNotification>, "in", false);
    case "outgoingMessageReceived":
      return parseMessage(body as Loose<MessageNotification>, "out", false);
    case "outgoingAPIMessageReceived":
      return parseMessage(body as Loose<MessageNotification>, "out", true);
    case "outgoingMessageStatus":
      return parseStatus(body as Loose<OutgoingMessageStatusNotification>);
    default:
      return null;
  }
}
