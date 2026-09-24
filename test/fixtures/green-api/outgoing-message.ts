// https://green-api.com/telegram/docs/api/receiving/notifications-format/outgoing-message/TextMessage/
import type { OutgoingMessageNotification } from "@/shared/api";

/** Sent from the phone or another client. */
export const outgoingMessage = {
  typeWebhook: "outgoingMessageReceived",
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
