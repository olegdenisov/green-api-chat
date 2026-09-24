// https://green-api.com/telegram/docs/api/receiving/notifications-format/outgoing-message/OutgoingApiMessage/
// The page elides `messageData`; it is taken from the outgoing TextMessage page.
import type { OutgoingMessageNotification } from "@/shared/api";

/** Sent via API (including by this app). */
export const outgoingApiMessage = {
  typeWebhook: "outgoingAPIMessageReceived",
  instanceData: {
    idInstance: 4100000000,
    wid: "79876543210@c.us",
    typeInstance: "telegram",
  },
  timestamp: 1763115112,
  idMessage: "1763115112345",
  senderData: {
    chatId: "10000000",
    chatType: "user",
    sender: "10000000",
    chatName: "Василиса Премудрая",
    senderName: "Василиса Премудрая",
    senderType: "user",
    senderContactName: "Василиса Премудрая",
    senderPhoneNumber: 79876543210,
  },
  messageData: {
    typeMessage: "textMessage",
    textMessageData: {
      textMessage: "Я использую GREEN-API для отправки этого сообщения!",
    },
  },
} satisfies OutgoingMessageNotification;
