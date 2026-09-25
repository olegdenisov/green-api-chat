import { ApiError } from "@/shared/api";
import type { GreenApi, RequestOptions, SettingsPatch } from "@/shared/api";

export type NotificationSettingsResult = "ok" | "updated" | "failed";

/** Settings that must be `yes` for incoming/outgoing messages to reach the notification queue. */
const REQUIRED_FLAGS = [
  "incomingWebhook",
  "outgoingMessageWebhook",
  "outgoingAPIMessageWebhook",
] as const;

/**
 * Makes the instance deliver notifications to the HTTP API queue: turns on the required
 * flags and clears `webhookUrl` with a single `setSettings`. `ApiError` → `"failed"`
 * (login still succeeds); cancellation and other errors are rethrown.
 */
export async function ensureNotificationSettings(
  api: Pick<GreenApi, "getSettings" | "setSettings">,
  options: RequestOptions = {},
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
    return "updated";
  } catch (error) {
    if (error instanceof ApiError) return "failed";
    throw error;
  }
}
