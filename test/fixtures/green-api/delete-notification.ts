// https://green-api.com/telegram/docs/api/receiving/technology-http-api/DeleteNotification/
import type { DeleteNotificationResponse } from "@/shared/api";

export const deleteNotificationResponse = {
  result: true,
  reason: "",
} satisfies DeleteNotificationResponse;
