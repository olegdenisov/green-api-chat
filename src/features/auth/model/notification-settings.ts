import { ApiError, type GreenApi, type RequestOptions, type SettingsPatch } from "@/shared/api";

/** `webhookCleared` — updated, and a non-empty `webhookUrl` was cleared (the user must know). */
type NotificationSettingsResult = "ok" | "updated" | "webhookCleared" | "failed";

/**
 * Settings that must be `yes` for incoming/outgoing messages and delivery statuses
 * (`outgoingMessageStatus`) to reach the notification queue.
 */
const REQUIRED_FLAGS = [
  "incomingWebhook",
  "outgoingMessageWebhook",
  "outgoingAPIMessageWebhook",
  "outgoingWebhook",
] as const;

/** Toast shown after login for each result except `ok`. */
export const SETTINGS_TOASTS: Record<
  Exclude<NotificationSettingsResult, "ok">,
  { color: string; message: string }
> = {
  updated: {
    color: "green",
    message:
      "Настройки инстанса обновлены. Новые сообщения и статусы начнут приходить в течение ~5 минут",
  },
  webhookCleared: {
    color: "green",
    message:
      "Инстанс переключён на этот чат: прежний адрес для уведомлений отключён. Новые сообщения и статусы начнут приходить в течение ~5 минут",
  },
  failed: {
    color: "yellow",
    message: "Не удалось проверить настройки инстанса — входящие могут не приходить",
  },
};

/**
 * Makes the instance deliver notifications to the HTTP API queue: turns on the required
 * flags and clears `webhookUrl` with a single `setSettings`. `ApiError` → `"failed"`
 * (login still succeeds); cancellation and other errors are rethrown.
 */
export async function ensureNotificationSettings(
  api: Pick<GreenApi, "getSettings" | "setSettings">,
  options: RequestOptions,
): Promise<NotificationSettingsResult> {
  try {
    const settings = await api.getSettings(options);
    const patch: SettingsPatch = {};
    for (const flag of REQUIRED_FLAGS) {
      if (settings[flag] !== "yes") patch[flag] = "yes";
    }
    if (settings.webhookUrl !== "") patch.webhookUrl = "";

    if (Object.keys(patch).length === 0) return "ok";
    await api.setSettings(patch, options);
    return patch.webhookUrl === undefined ? "updated" : "webhookCleared";
  } catch (error) {
    if (error instanceof ApiError) return "failed";
    throw error;
  }
}
