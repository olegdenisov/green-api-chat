// Notifications the app receives but does not show. Their kinds are outside the
// `Notification` union (it lists supported kinds only), so they cannot `satisfies` it: the
// media message checks everything but `messageData`. The shapes are copied from the Telegram
// docs pages linked above each fixture. Ignored statuses (`failed`, `noAccount`) are in
// `outgoing-message-status.ts`.
// A group message fixture is `incomingGroupTextMessage` in `incoming-text-message.ts`.
import type { IncomingMessageNotification } from "@/shared/api";

// https://green-api.com/telegram/docs/api/receiving/notifications-format/incoming-message/ImageMessage/
/** Media: `typeWebhook` is supported, `typeMessage` is not (so only the rest is checked). */
export const incomingImageMessage = {
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
    typeMessage: "imageMessage",
    fileMessageData: {
      downloadUrl:
        "https://4100.api.green-api.com/download/4100/15697d2c-397c-4fd0-8e1a-8be95f753aae.webp",
      caption: "",
      fileName: "1769056990.jpg",
      jpegThumbnail:
        "UklGRjoAAABXRUJQVlA4IC4AAACwAwCdASoyADIAPm0skkYkIqGhLggAgA2JaQAAZAEm0xUUDzF5wAD++yGAAAAA",
      isAnimated: false,
      mimeType: "image/jpg",
      forwardingScore: 0,
      isForwarded: false,
    },
  },
} satisfies Omit<IncomingMessageNotification, "messageData"> & {
  messageData: { typeMessage: string; [key: string]: unknown };
};
