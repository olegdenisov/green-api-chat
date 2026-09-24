// https://green-api.com/telegram/docs/api/receiving/notifications-format/incoming-message/TextMessage/
import type { IncomingMessageNotification } from "@/shared/api";

export const incomingTextMessage = {
  typeWebhook: "incomingMessageReceived",
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
    senderPhoneNumber: 79998887766,
  },
  messageData: {
    typeMessage: "textMessage",
    textMessageData: {
      textMessage: "Я использую GREEN-API для отправки этого сообщения!",
      forwardingScore: 0,
      isForwarded: false,
    },
  },
} satisfies IncomingMessageNotification;

export const incomingGroupTextMessage = {
  typeWebhook: "incomingMessageReceived",
  instanceData: {
    idInstance: 4100000000,
    wid: "79876543210@c.us",
    typeInstance: "telegram",
  },
  timestamp: 1763115112,
  idMessage: "1763115112345",
  senderData: {
    chatId: "-10000000000000",
    chatType: "supergroup",
    sender: "10000000",
    chatName: "Тридесятое царство",
    senderName: "Василиса",
    senderType: "user",
    senderContactName: "",
    senderPhoneNumber: 0,
  },
  messageData: {
    typeMessage: "textMessage",
    textMessageData: {
      textMessage: "Я использую GREEN-API для отправки этого сообщения!",
      forwardingScore: 1,
      isForwarded: true,
    },
  },
} satisfies IncomingMessageNotification;
