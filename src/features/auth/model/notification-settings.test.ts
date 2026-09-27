import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api";
import type { GreenApi, Settings } from "@/shared/api";

import { getSettingsResponse } from "@test/fixtures/green-api/get-settings";
import { setSettingsResponse } from "@test/fixtures/green-api/set-settings";

import { ensureNotificationSettings } from "./notification-settings";

function fakeApi(settings: Partial<Settings> = {}) {
  return {
    getSettings: vi.fn<GreenApi["getSettings"]>(async () => ({
      ...getSettingsResponse,
      ...settings,
    })),
    setSettings: vi.fn<GreenApi["setSettings"]>(async () => setSettingsResponse),
  };
}

describe("ensureNotificationSettings", () => {
  it("returns ok without setSettings when everything is on", async () => {
    const api = fakeApi();
    await expect(ensureNotificationSettings(api, {})).resolves.toBe("ok");
    expect(api.setSettings).not.toHaveBeenCalled();
  });

  it("turns on only the disabled flag", async () => {
    const api = fakeApi({ outgoingAPIMessageWebhook: "no" });
    await expect(ensureNotificationSettings(api, {})).resolves.toBe("updated");
    expect(api.setSettings).toHaveBeenCalledOnce();
    expect(api.setSettings.mock.calls[0]![0]).toEqual({ outgoingAPIMessageWebhook: "yes" });
  });

  it("turns on outgoingWebhook for delivery statuses", async () => {
    const api = fakeApi({ outgoingWebhook: "no" });
    await expect(ensureNotificationSettings(api, {})).resolves.toBe("updated");
    expect(api.setSettings.mock.calls[0]![0]).toEqual({ outgoingWebhook: "yes" });
  });

  it("clears a non-empty webhookUrl", async () => {
    const api = fakeApi({ webhookUrl: "https://example.com/hook", incomingWebhook: "no" });
    await expect(ensureNotificationSettings(api, {})).resolves.toBe("webhookCleared");
    expect(api.setSettings.mock.calls[0]![0]).toEqual({ webhookUrl: "", incomingWebhook: "yes" });
  });

  it("passes the signal to both requests", async () => {
    const api = fakeApi({ incomingWebhook: "no" });
    const { signal } = new AbortController();
    await ensureNotificationSettings(api, { signal });
    expect(api.getSettings).toHaveBeenCalledWith({ signal });
    expect(api.setSettings).toHaveBeenCalledWith({ incomingWebhook: "yes" }, { signal });
  });

  it("returns failed when getSettings throws ApiError", async () => {
    const api = fakeApi();
    api.getSettings.mockRejectedValue(new ApiError("http", { status: 500 }));
    await expect(ensureNotificationSettings(api, {})).resolves.toBe("failed");
    expect(api.setSettings).not.toHaveBeenCalled();
  });

  it("returns failed when setSettings throws ApiError", async () => {
    const api = fakeApi({ incomingWebhook: "no" });
    api.setSettings.mockRejectedValue(new ApiError("network"));
    await expect(ensureNotificationSettings(api, {})).resolves.toBe("failed");
  });

  it("rethrows cancellation", async () => {
    const api = fakeApi();
    const controller = new AbortController();
    controller.abort();
    const abort: unknown = controller.signal.reason;
    api.getSettings.mockRejectedValue(abort);
    await expect(ensureNotificationSettings(api, {})).rejects.toBe(abort);
  });

  it("rethrows unexpected errors", async () => {
    const api = fakeApi({ incomingWebhook: "no" });
    const error = new TypeError("boom");
    api.setSettings.mockRejectedValue(error);
    await expect(ensureNotificationSettings(api, {})).rejects.toBe(error);
  });
});
