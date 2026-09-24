import { beforeEach, describe, expect, it } from "vitest";

import {
  checkAccountExists,
  checkAccountInstanceNotReady,
  checkAccountNotExists,
  checkAccountRateLimitedByMessenger,
  checkAccountRateLimitExceeded,
} from "@test/fixtures/green-api/check-account";
import { deleteNotificationResponse } from "@test/fixtures/green-api/delete-notification";
import { getSettingsResponse } from "@test/fixtures/green-api/get-settings";
import { getStateInstanceResponse } from "@test/fixtures/green-api/get-state-instance";
import { receiveNotificationResponse } from "@test/fixtures/green-api/receive-notification";
import { sendMessageRequest, sendMessageResponse } from "@test/fixtures/green-api/send-message";
import { setSettingsRequest, setSettingsResponse } from "@test/fixtures/green-api/set-settings";
import {
  BASE,
  creds,
  fetchMock,
  hangUntilAbort,
  respond,
  respondJson,
  stubFetch,
  TOKEN,
} from "@test/green-api";

import { ApiError } from "./api-error";
import { createGreenApi, type GreenApi } from "./green-api";
import type { SendMessageRequest } from "./types";

const PHONE = checkAccountExists.phoneNumber;

beforeEach(stubFetch);

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
});

describe("createGreenApi: checkAccount", () => {
  it("sends the phone number as a JSON number", async () => {
    respondJson(checkAccountExists);

    await expect(api.checkAccount(PHONE)).resolves.toEqual(checkAccountExists);
    const call = lastCall();
    expect(call.url).toBe(`${BASE}/checkAccount/${TOKEN}`);
    expect(call.method).toBe("POST");
    expect(call.headers).toEqual({ "Content-Type": "application/json" });
    expect(call.body).toEqual({ phoneNumber: PHONE });
  });

  it("returns exist: false as is", async () => {
    respondJson(checkAccountNotExists);

    await expect(api.checkAccount(PHONE)).resolves.toEqual(checkAccountNotExists);
  });

  it("maps rate_limit_exceeded with HTTP 200 to a rate-limit error", async () => {
    respondJson(checkAccountRateLimitExceeded);

    const promise = api.checkAccount(PHONE);
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ kind: "rate-limit", status: undefined });
    await expect(promise).rejects.toHaveProperty("cause", checkAccountRateLimitExceeded);
  });

  it("returns other HTTP 200 failures as is", async () => {
    respondJson(checkAccountInstanceNotReady);

    await expect(api.checkAccount(PHONE)).resolves.toEqual(checkAccountInstanceNotReady);
  });

  it("returns an HTTP 200 failure with another data.reason as is", async () => {
    const failure = { status: false, data: { status: "fail", reason: "other" } };
    respondJson(failure);

    await expect(api.checkAccount(PHONE)).resolves.toEqual(failure);
  });

  it("maps HTTP 469 to a rate-limit error", async () => {
    respondJson(checkAccountRateLimitedByMessenger, 469);

    const promise = api.checkAccount(PHONE);
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ kind: "rate-limit", status: 469 });
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

  it("sends only chatId and message", async () => {
    respondJson(sendMessageResponse);

    await api.sendMessage({ ...sendMessageRequest, quotedMessageId: "x" } as SendMessageRequest);
    expect(lastCall().body).toEqual(sendMessageRequest);
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

  it("receiveNotification returns null for an empty body", async () => {
    respond("");

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

const calls: [string, (client: GreenApi, signal?: AbortSignal) => Promise<unknown>][] = [
  ["getStateInstance", (client, signal) => client.getStateInstance({ signal })],
  ["getSettings", (client, signal) => client.getSettings({ signal })],
  ["setSettings", (client, signal) => client.setSettings(setSettingsRequest, { signal })],
  ["checkAccount", (client, signal) => client.checkAccount(PHONE, { signal })],
  ["sendMessage", (client, signal) => client.sendMessage(sendMessageRequest, { signal })],
  [
    "receiveNotification",
    (client, signal) => client.receiveNotification({ receiveTimeout: 20, signal }),
  ],
  ["deleteNotification", (client, signal) => client.deleteNotification(1, { signal })],
];

const bodyRequired = calls.filter(([name]) => name !== "receiveNotification");

describe("createGreenApi: empty body", () => {
  it.each(bodyRequired)("%s rejects with an http error on an empty body", async (_name, call) => {
    respond("");

    const promise = call(api);
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ kind: "http", status: undefined });
  });
});

describe("createGreenApi: signal", () => {
  it.each(calls)("%s passes the signal to fetch", async (_name, call) => {
    respondJson({});
    const controller = new AbortController();

    await call(api, controller.signal);
    expect(lastCall().signal).toBe(controller.signal);
  });

  it.each(calls)("%s rejects with the abort reason", async (_name, call) => {
    hangUntilAbort();
    const controller = new AbortController();
    const reason = new Error("stop");

    const promise = call(api, controller.signal);
    controller.abort(reason);
    await expect(promise).rejects.toBe(reason);
  });
});
