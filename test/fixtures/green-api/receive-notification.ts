// https://green-api.com/telegram/docs/api/receiving/technology-http-api/ReceiveNotification/
import type { ReceivedNotification } from "@/shared/api";

/** Note: this doc example has no `senderData.chatType`. */
export const receiveNotificationResponse = {
  receiptId: 1234567,
  body: {
    typeWebhook: "incomingMessageReceived",
    instanceData: {
      idInstance: 410000001,
      wid: "79876543210@c.us",
      typeInstance: "telegram",
    },
    timestamp: 1763115112,
    idMessage: "126543123451133331119",
    senderData: {
      chatId: "10000000",
      chatName: "Василиса",
      sender: "10000000",
      senderName: "Василиса Премудрая",
      senderContactName: "Василиса Премудрая",
      senderPhoneNumber: 79876543210,
    },
    messageData: {
      typeMessage: "textMessage",
      textMessageData: {
        textMessage: "Привет от Green-API!",
      },
    },
  },
} satisfies ReceivedNotification;
