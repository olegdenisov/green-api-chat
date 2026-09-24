// https://green-api.com/telegram/docs/api/receiving/notifications-format/incoming-message/ExtendedTextMessage/
import type { IncomingMessageNotification } from "@/shared/api";

export const incomingExtendedTextMessage = {
  typeWebhook: "incomingMessageReceived",
  instanceData: {
    idInstance: 4100000000,
    wid: "79876543210@c.us",
    typeInstance: "telegram",
  },
  timestamp: 1770351383,
  idMessage: "1763115112345",
  senderData: {
    chatId: "10000000",
    chatType: "user",
    sender: "10000000",
    chatName: "Василиса",
    senderName: "Василиса Премудрая",
    senderType: "user",
    senderContactName: "Василиса Премудрая",
    senderPhoneNumber: 79998887766,
  },
  messageData: {
    typeMessage: "extendedTextMessage",
    extendedTextMessageData: {
      text: "Я использую GREEN-API для отправки этого сообщения! Документация на сайте https://green-api.com/",
      description: "GREEN-API docs shows how you can develop the Telegram Bot",
      title: "How to develop Telegram Bot",
      jpegThumbnail:
        "UklGRjoAAABXRUJQVlA4IC4AAACwAwCdASoyADIAPm0skkYkIqGhLggAgA2JaQAAZAEm0xUUDzF5wAD++yGAAAAA",
    },
  },
} satisfies IncomingMessageNotification;
