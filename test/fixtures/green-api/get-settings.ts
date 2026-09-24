// https://green-api.com/telegram/docs/api/account/GetSettings/
import type { Settings } from "@/shared/api";

export const getSettingsResponse = {
  wid: "79876543210@c.us",
  typeInstance: "telegram",
  webhookUrl: "",
  webhookUrlToken: "",
  delaySendMessagesMilliseconds: 500,
  markIncomingMessagesReaded: "no",
  markIncomingMessagesReadedOnReply: "no",
  outgoingWebhook: "yes",
  outgoingMessageWebhook: "yes",
  outgoingAPIMessageWebhook: "yes",
  incomingWebhook: "yes",
  stateWebhook: "yes",
  keepOnlineStatus: "no",
  editedMessageWebhook: "yes",
  deletedMessageWebhook: "yes",
} satisfies Settings;
