import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./api-error";
import { request } from "./request";
import type { Credentials } from "./types";

const TOKEN = "d75b3a66374942c5b3c019c698abc2067e151558acbd412345";

const creds: Credentials = {
  idInstance: "1101000001",
  apiTokenInstance: TOKEN,
  apiUrl: "https://1101.api.green-api.com",
};

const BASE = `https://1101.api.green-api.com/waInstance1101000001`;

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function respond(body: string | null, status = 200) {
  fetchMock.mockImplementation(async () => new Response(body, { status }));
}

/** Mock that never settles on its own and rejects with the signal's reason on abort. */
function hangUntilAbort() {
  fetchMock.mockImplementation(
    (_, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      }),
  );
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the promise to reject");
}

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

  it("adds query and path suffix", async () => {
    respond("null");

    await request({
      creds,
      method: "receiveNotification",
      httpMethod: "GET",
      query: { receiveTimeout: 20 },
    });
    await request({
      creds,
      method: "deleteNotification",
      httpMethod: "DELETE",
      pathSuffix: 42,
    });

    expect(fetchMock.mock.calls[0]![0]).toBe(
      `${BASE}/receiveNotification/${TOKEN}?receiveTimeout=20`,
    );
    expect(fetchMock.mock.calls[1]![0]).toBe(`${BASE}/deleteNotification/${TOKEN}/42`);
    expect(fetchMock.mock.calls[1]![1]?.method).toBe("DELETE");
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

    await request({ creds, method: "getSettings", httpMethod: "GET", signal: controller.signal });

    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
  });

  it("returns null for an empty body", async () => {
    respond("");
    await expect(request({ creds, method: "m", httpMethod: "GET" })).resolves.toBeNull();
  });

  it("returns null for a null body", async () => {
    respond("null");
    await expect(request({ creds, method: "m", httpMethod: "GET" })).resolves.toBeNull();
  });
});

describe("request: errors", () => {
  it("maps a rejected fetch to a network error with cause", async () => {
    const cause = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValue(cause);

    const error = await catchError(request({ creds, method: "m", httpMethod: "GET" }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: "ApiError", kind: "network", status: undefined });
    expect((error as ApiError).cause).toBe(cause);
  });

  it.each([
    [401, "auth"],
    [403, "auth"],
    [469, "rate-limit"],
    [500, "http"],
    [404, "http"],
  ] as const)("maps HTTP %i to %s", async (status, kind) => {
    respond("error", status);

    const error = await catchError(request({ creds, method: "m", httpMethod: "GET" }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind, status });
  });

  it("maps invalid JSON to an http error", async () => {
    respond("{not json");

    const error = await catchError(request({ creds, method: "m", httpMethod: "GET" }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "http", status: 200 });
    expect((error as ApiError).cause).toBeInstanceOf(SyntaxError);
  });

  it("never exposes the token in the error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const network = await catchError(request({ creds, method: "m", httpMethod: "GET" }));
    respond("", 401);
    const auth = await catchError(request({ creds, method: "m", httpMethod: "GET" }));

    for (const error of [network, auth]) {
      expect((error as Error).message).not.toContain(TOKEN);
      expect(String(error)).not.toContain(TOKEN);
    }
  });
});

describe("request: abort", () => {
  it("rethrows the reason when the signal is already aborted", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Aborted", "AbortError");
    controller.abort(reason);

    const error = await catchError(
      request({ creds, method: "m", httpMethod: "GET", signal: controller.signal }),
    );

    expect(error).toBe(reason);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rethrows the reason when aborted during fetch", async () => {
    hangUntilAbort();
    const controller = new AbortController();
    const reason = new Error("stop polling");

    const promise = request({ creds, method: "m", httpMethod: "GET", signal: controller.signal });
    controller.abort(reason);
    const error = await catchError(promise);

    expect(error).toBe(reason);
    expect(error).not.toBeInstanceOf(ApiError);
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

    const error = await catchError(
      request({ creds, method: "m", httpMethod: "GET", signal: controller.signal }),
    );

    expect(error).toBe(reason);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});
