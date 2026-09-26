import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { BASE, creds, fetchMock, hangUntilAbort, respond, stubFetch, TOKEN } from "@test/green-api";

import { ApiError } from "./api-error";
import { request } from "./request";

beforeEach(stubFetch);

const get = (signal?: AbortSignal) =>
  request({ creds, method: "getStateInstance", httpMethod: "GET", signal });

describe("request: success", () => {
  it("sends a GET without body and headers", async () => {
    respond('{"stateInstance":"authorized"}');

    const result = await request({ creds, method: "getStateInstance", httpMethod: "GET" });

    expect(result).toEqual({ stateInstance: "authorized" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}/getStateInstance/${TOKEN}`);
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toBeUndefined();
  });

  it("sends a JSON body with Content-Type", async () => {
    respond('{"idMessage":"abc"}');

    await request({
      creds,
      method: "sendMessage",
      httpMethod: "POST",
      body: { chatId: "12345", message: "hi" },
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}/sendMessage/${TOKEN}`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(init?.body).toBe('{"chatId":"12345","message":"hi"}');
  });

  it("adds the query", async () => {
    respond("null");

    await request({
      creds,
      method: "receiveNotification",
      httpMethod: "GET",
      query: { receiveTimeout: 20 },
    });

    expect(fetchMock.mock.calls[0]![0]).toBe(
      `${BASE}/receiveNotification/${TOKEN}?receiveTimeout=20`,
    );
  });

  it("adds no '?' for an empty query", async () => {
    respond("null");

    await request({ creds, method: "receiveNotification", httpMethod: "GET", query: {} });

    expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE}/receiveNotification/${TOKEN}`);
  });

  it("adds the path suffix", async () => {
    respond("{}");

    await request({ creds, method: "deleteNotification", httpMethod: "DELETE", pathSuffix: 42 });

    expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE}/deleteNotification/${TOKEN}/42`);
    expect(fetchMock.mock.calls[0]![1]?.method).toBe("DELETE");
  });

  it("encodes idInstance and the token", async () => {
    respond("{}");

    await request({
      creds: { ...creds, idInstance: "1/2", apiTokenInstance: "a/b#c?d" },
      method: "getSettings",
      httpMethod: "GET",
    });

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://1101.api.green-api.com/waInstance1%2F2/getSettings/a%2Fb%23c%3Fd",
    );
  });

  it("strips a trailing slash from apiUrl", async () => {
    respond("{}");

    await request({
      creds: { ...creds, apiUrl: "https://1101.api.green-api.com/" },
      method: "getSettings",
      httpMethod: "GET",
    });

    expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE}/getSettings/${TOKEN}`);
  });

  it("passes the signal to fetch", async () => {
    respond("{}");
    const controller = new AbortController();

    await get(controller.signal);

    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
  });

  it("returns null for an empty body", async () => {
    respond("");
    await expect(get()).resolves.toBeNull();
  });

  it("returns null for a null body", async () => {
    respond("null");
    await expect(get()).resolves.toBeNull();
  });

  it("returns null for 204 without a body", async () => {
    respond(null, 204);
    await expect(get()).resolves.toBeNull();
  });
});

describe("request: errors", () => {
  it("maps a rejected fetch to a network error with cause", async () => {
    const cause = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValue(cause);

    const promise = get();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      name: "ApiError",
      kind: "network",
      status: undefined,
      message: "GREEN-API: network request failed",
    });
    await expect(promise).rejects.toHaveProperty("cause", cause);
  });

  it.each([
    [401, "auth"],
    [403, "auth"],
    [469, "rate-limit"],
    [500, "http"],
    [404, "http"],
  ] as const)("maps HTTP %i to %s", async (status, kind) => {
    respond("error", status);

    const promise = get();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ kind, status });
  });

  it("adds the HTTP status to the message", async () => {
    respond("error", 500);
    await expect(get()).rejects.toThrow("GREEN-API: unexpected response (HTTP 500)");
  });

  it("cancels the unread body of a non-2xx response", async () => {
    const response = new Response("error", { status: 500 });
    const cancel = vi.spyOn(response.body!, "cancel");
    fetchMock.mockResolvedValue(response);

    await expect(get()).rejects.toBeInstanceOf(ApiError);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("maps invalid JSON to an http error", async () => {
    respond("{not json");

    const promise = get();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ kind: "http", status: 200 });
    await expect(promise).rejects.toHaveProperty("cause", expect.any(SyntaxError));
  });

  it("maps a failed body read to a network error with status and cause", async () => {
    const cause = new TypeError("terminated");
    const response = new Response("{}");
    vi.spyOn(response, "text").mockRejectedValue(cause);
    fetchMock.mockResolvedValue(response);

    const promise = get(new AbortController().signal);

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ kind: "network", status: 200 });
    await expect(promise).rejects.toHaveProperty("cause", cause);
  });

  it("never exposes the token in the error", async () => {
    const errors: unknown[] = [];
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    errors.push(await get().catch((e: unknown) => e));
    for (const [body, status] of [
      ["", 401],
      ["", 469],
      ["", 500],
      ["{not json", 200],
    ] as const) {
      respond(body, status);
      errors.push(await get().catch((e: unknown) => e));
    }

    expect(errors.map((e) => (e as ApiError).kind)).toEqual([
      "network",
      "auth",
      "rate-limit",
      "http",
      "http",
    ]);
    for (const error of errors) {
      expect((error as Error).message).not.toContain(TOKEN);
      expect(String(error)).not.toContain(TOKEN);
      expect(String((error as Error).cause)).not.toContain(TOKEN);
    }
  });
});

describe("request: abort", () => {
  it("rethrows the reason when the signal is already aborted", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Aborted", "AbortError");
    controller.abort(reason);

    await expect(get(controller.signal)).rejects.toBe(reason);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rethrows the reason when aborted during fetch", async () => {
    hangUntilAbort();
    const controller = new AbortController();
    const reason = new Error("stop polling");

    const promise = get(controller.signal);
    controller.abort(reason);

    await expect(promise).rejects.toBe(reason);
  });

  it("rethrows the abort reason when fetch failed for another reason", async () => {
    const controller = new AbortController();
    const reason = new Error("stop polling");
    fetchMock.mockImplementation(async () => {
      controller.abort(reason);
      throw new TypeError("Failed to fetch");
    });

    await expect(get(controller.signal)).rejects.toBe(reason);
  });

  it("rethrows the reason when aborted after a non-2xx response", async () => {
    const controller = new AbortController();
    const reason = new Error("stop polling");
    fetchMock.mockImplementation(async () => {
      controller.abort(reason);
      return new Response("error", { status: 500 });
    });

    await expect(get(controller.signal)).rejects.toBe(reason);
  });

  it("rethrows the reason when aborted while reading the body", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Aborted", "AbortError");
    const response = new Response("{}");
    vi.spyOn(response, "text").mockImplementation(() => {
      controller.abort(reason);
      return Promise.reject(reason);
    });
    fetchMock.mockResolvedValue(response);

    await expect(get(controller.signal)).rejects.toBe(reason);
  });
});

describe("request: timeout", () => {
  const getWithTimeout = (signal?: AbortSignal) =>
    request({ creds, method: "getStateInstance", httpMethod: "GET", signal, timeout: 1000 });

  function useFakeTimers() {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
  }

  it("rejects with a TimeoutError, not ApiError, once the timeout elapses", async () => {
    useFakeTimers();
    hangUntilAbort();

    const promise = getWithTimeout();
    const settled = promise.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    const error = await settled;
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: "TimeoutError" });
  });

  it("rethrows the external reason when aborted before the timeout", async () => {
    useFakeTimers();
    hangUntilAbort();
    const controller = new AbortController();
    const reason = new DOMException("Aborted", "AbortError");

    const promise = getWithTimeout(controller.signal);
    controller.abort(reason);

    await expect(promise).rejects.toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rethrows the reason of an already aborted signal without fetching", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Aborted", "AbortError");
    controller.abort(reason);

    await expect(getWithTimeout(controller.signal)).rejects.toBe(reason);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the timer and the abort listener after a response", async () => {
    useFakeTimers();
    respond('{"stateInstance":"authorized"}');
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");

    await expect(getWithTimeout(controller.signal)).resolves.toEqual({
      stateInstance: "authorized",
    });

    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
    // The request's own signal is not aborted by a later abort of the caller's one.
    const requestSignal = fetchMock.mock.calls[0]![1]?.signal;
    controller.abort();
    expect(requestSignal?.aborted).toBe(false);
  });

  it("clears the timer after an error response", async () => {
    useFakeTimers();
    respond("error", 500);

    await expect(getWithTimeout()).rejects.toMatchObject({ kind: "http", status: 500 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sets no timer without the option", async () => {
    useFakeTimers();
    hangUntilAbort();
    const controller = new AbortController();

    const promise = get(controller.signal);

    expect(vi.getTimerCount()).toBe(0);
    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});
