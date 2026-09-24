// https://green-api.com/telegram/docs/api/account/SetSettings/
import type { SetSettingsResponse, SettingsPatch } from "@/shared/api";

export const setSettingsRequest = {
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
} satisfies SettingsPatch;

export const setSettingsResponse = {
  saveSettings: true,
} satisfies SetSettingsResponse;
