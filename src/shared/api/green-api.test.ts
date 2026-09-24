import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkAccountExists,
  checkAccountInstanceNotReady,
  checkAccountNotExists,
  checkAccountRateLimitExceeded,
  checkAccountRequest,
} from "@test/fixtures/green-api/check-account";
import { deleteNotificationResponse } from "@test/fixtures/green-api/delete-notification";
import { getSettingsResponse } from "@test/fixtures/green-api/get-settings";
import { getStateInstanceResponse } from "@test/fixtures/green-api/get-state-instance";
import { receiveNotificationResponse } from "@test/fixtures/green-api/receive-notification";
import { sendMessageRequest, sendMessageResponse } from "@test/fixtures/green-api/send-message";
import { setSettingsRequest, setSettingsResponse } from "@test/fixtures/green-api/set-settings";

import { ApiError } from "./api-error";
import { createGreenApi } from "./green-api";
import type { Credentials } from "./types";

const TOKEN = "d75b3a66374942c5b3c019c698abc2067e151558acbd412345";

const creds: Credentials = {
  idInstance: "1101000001",
  apiTokenInstance: TOKEN,
  apiUrl: "https://1101.api.green-api.com",
};

const BASE = "https://1101.api.green-api.com/waInstance1101000001";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function respondJson(body: unknown, status = 200) {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(body), { status }));
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return {
    url,
    method: init?.method,
    headers: init?.headers,
    body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : init?.body,
    signal: init?.signal,
  };
}

const api = createGreenApi(creds);

describe("createGreenApi: account", () => {
  it("getStateInstance sends GET and returns the state", async () => {
    respondJson(getStateInstanceResponse);

    await expect(api.getStateInstance()).resolves.toEqual(getStateInstanceResponse);
    const call = lastCall();
    expect(call.url).toBe(`${BASE}/getStateInstance/${TOKEN}`);
    expect(call.method).toBe("GET");
    expect(call.body).toBeUndefined();
  });

  it("getSettings sends GET and returns the settings", async () => {
    respondJson(getSettingsResponse);

    await expect(api.getSettings()).resolves.toEqual(getSettingsResponse);
    const call = lastCall();
    expect(call.url).toBe(`${BASE}/getSettings/${TOKEN}`);
    expect(call.method).toBe("GET");
  });

  it("setSettings sends the patch as JSON POST", async () => {
    respondJson(setSettingsResponse);

    await expect(api.setSettings(setSettingsRequest)).resolves.toEqual(setSettingsResponse);
    const call = lastCall();
    expect(call.url).toBe(`${BASE}/setSettings/${TOKEN}`);
    expect(call.method).toBe("POST");
    expect(call.headers).toEqual({ "Content-Type": "application/json" });
    expect(call.body).toEqual(setSettingsRequest);
  });

  it("rejects with an http error on an empty body", async () => {
    fetchMock.mockImplementation(async () => new Response("", { status: 200 }));

    const error = await api.getStateInstance().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("http");
  });
});

describe("createGreenApi: checkAccount", () => {
  it("sends the phone number as a JSON number", async () => {
    respondJson(checkAccountExists);

    await expect(api.checkAccount(checkAccountRequest.phoneNumber)).resolves.toEqual(
      checkAccountExists,
    );
    const call = lastCall();
    expect(call.url).toBe(`${BASE}/checkAccount/${TOKEN}`);
    expect(call.method).toBe("POST");
    expect(call.headers).toEqual({ "Content-Type": "application/json" });
    expect(call.body).toEqual(checkAccountRequest);
  });

  it("returns exist: false as is", async () => {
    respondJson(checkAccountNotExists);

    await expect(api.checkAccount(79876543210)).resolves.toEqual(checkAccountNotExists);
  });

  it("maps rate_limit_exceeded with HTTP 200 to a rate-limit error", async () => {
    respondJson(checkAccountRateLimitExceeded);

    const error = await api.checkAccount(79876543210).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("rate-limit");
  });

  it("returns other HTTP 200 failures as is", async () => {
    respondJson(checkAccountInstanceNotReady);

    await expect(api.checkAccount(79876543210)).resolves.toEqual(checkAccountInstanceNotReady);
  });

  it("maps HTTP 469 to a rate-limit error", async () => {
    respondJson({ status: false, reason: "Rate limited by messenger" }, 469);

    const error = await api.checkAccount(79876543210).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "rate-limit", status: 469 });
  });
});

describe("createGreenApi: sendMessage", () => {
  it("sends chatId and message as JSON POST", async () => {
    respondJson(sendMessageResponse);

    await expect(api.sendMessage(sendMessageRequest)).resolves.toEqual(sendMessageResponse);
    const call = lastCall();
    expect(call.url).toBe(`${BASE}/sendMessage/${TOKEN}`);
    expect(call.method).toBe("POST");
    expect(call.headers).toEqual({ "Content-Type": "application/json" });
    expect(call.body).toEqual(sendMessageRequest);
  });
});

describe("createGreenApi: notifications", () => {
  it("receiveNotification without receiveTimeout sends no query", async () => {
    respondJson(receiveNotificationResponse);

    await expect(api.receiveNotification()).resolves.toEqual(receiveNotificationResponse);
    const call = lastCall();
    expect(call.url).toBe(`${BASE}/receiveNotification/${TOKEN}`);
    expect(call.method).toBe("GET");
  });

  it("receiveNotification with receiveTimeout adds the query", async () => {
    respondJson(receiveNotificationResponse);

    await api.receiveNotification({ receiveTimeout: 20 });
    expect(lastCall().url).toBe(`${BASE}/receiveNotification/${TOKEN}?receiveTimeout=20`);
  });

  it("receiveNotification returns null for an empty queue", async () => {
    respondJson(null);

    await expect(api.receiveNotification()).resolves.toBeNull();
  });

  it("deleteNotification puts receiptId into the path", async () => {
    respondJson(deleteNotificationResponse);

    await expect(api.deleteNotification(1234567)).resolves.toEqual(deleteNotificationResponse);
    const call = lastCall();
    expect(call.url).toBe(`${BASE}/deleteNotification/${TOKEN}/1234567`);
    expect(call.method).toBe("DELETE");
    expect(call.body).toBeUndefined();
  });
});

describe("createGreenApi: signal", () => {
  it.each([
    ["getStateInstance", (signal: AbortSignal) => api.getStateInstance({ signal })],
    ["getSettings", (signal: AbortSignal) => api.getSettings({ signal })],
    ["setSettings", (signal: AbortSignal) => api.setSettings(setSettingsRequest, { signal })],
    ["checkAccount", (signal: AbortSignal) => api.checkAccount(79876543210, { signal })],
    ["sendMessage", (signal: AbortSignal) => api.sendMessage(sendMessageRequest, { signal })],
    [
      "receiveNotification",
      (signal: AbortSignal) => api.receiveNotification({ receiveTimeout: 20, signal }),
    ],
    ["deleteNotification", (signal: AbortSignal) => api.deleteNotification(1, { signal })],
  ])("%s passes the signal to fetch", async (_name, call) => {
    respondJson({});
    const controller = new AbortController();

    await call(controller.signal);
    expect(lastCall().signal).toBe(controller.signal);
  });
});
