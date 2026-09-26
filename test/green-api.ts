import { onTestFinished, vi } from "vitest";

import type { Credentials } from "@/shared/api";

// Shared setup for GREEN-API client tests: example credentials from the docs (not real)
// and a `fetch` mock. `test.unstubGlobals: true` removes the stub after each test.

export const TOKEN = "d75b3a66374942c5b3c019c698abc2067e151558acbd412345";

export const creds: Credentials = {
  idInstance: "1101000001",
  apiTokenInstance: TOKEN,
  apiUrl: "https://1101.api.green-api.com",
};

/** URL prefix for `creds`; append `/{method}/${TOKEN}`. */
export const BASE = "https://1101.api.green-api.com/waInstance1101000001";

export const fetchMock = vi.fn<typeof fetch>();

/** Call in `beforeEach`: resets the mock and installs it as the global `fetch`. */
export function stubFetch() {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
}

/** Every call resolves with `body` (`null`/`""` — an empty body) and `status`. */
export function respond(body: string | null, status = 200) {
  fetchMock.mockImplementation(async () => new Response(body, { status }));
}

/** Every call resolves with `JSON.stringify(body)` and `status`. */
export function respondJson(body: unknown, status = 200) {
  respond(JSON.stringify(body), status);
}

/** A request that never settles on its own and rejects with the signal's reason on abort. */
function hang(init: RequestInit | undefined): Promise<Response> {
  const signal = init?.signal;
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

/** `fetch` never settles on its own and rejects with the signal's reason on abort. */
export function hangUntilAbort() {
  fetchMock.mockImplementation((_, init) => hang(init));
}

/** `"hang"` — the request never settles and rejects with the signal's reason on abort. */
type MethodResponse = { body: unknown; status?: number } | "hang";

function urlOf(input: Parameters<typeof fetch>[0]): string {
  return input instanceof Request ? input.url : String(input);
}

/**
 * GREEN-API method name from a request URL: `.../waInstance{id}/{method}/{token}[/{suffix}]`
 * (`deleteNotification` has the `receiptId` after the token).
 */
function methodOf(input: Parameters<typeof fetch>[0]): string {
  const segments = new URL(urlOf(input)).pathname.split("/");
  const instance = segments.findIndex((segment) => segment.startsWith("waInstance"));
  return instance === -1 ? "" : (segments[instance + 1] ?? "");
}

/** URLs of the requests made so far, in order. */
export function calledUrls(): string[] {
  return fetchMock.mock.calls.map(([input]) => urlOf(input));
}

/**
 * Answers by the GREEN-API method name from the URL: `body` as JSON with `status` (200 by
 * default); `"hang"` keeps the request pending until aborted (the notification polling of a
 * rendered chat screen: `receiveNotification: "hang"`). An array answers the calls of the
 * method in order and repeats its last item (`[{ body: notification }, "hang"]` — one
 * notification, then an empty long poll). A method missing from `responses` rejects the
 * request and fails the test when it finishes — the client would otherwise turn the rejection
 * into `ApiError("network")`. Call inside a test (uses `onTestFinished`).
 */
export function respondByMethod(
  responses: Partial<Record<string, MethodResponse | [MethodResponse, ...MethodResponse[]]>>,
) {
  const calls = new Map<string, number>();
  const unexpected: string[] = [];
  onTestFinished(() => {
    if (unexpected.length > 0) {
      throw new Error(`respondByMethod: unexpected GREEN-API calls: ${unexpected.join(", ")}`);
    }
  });
  fetchMock.mockImplementation(async (input, init) => {
    const method = methodOf(input);
    const answer = responses[method];
    const index = calls.get(method) ?? 0;
    calls.set(method, index + 1);
    const response = Array.isArray(answer) ? answer[Math.min(index, answer.length - 1)] : answer;
    if (!response) {
      unexpected.push(method);
      throw new Error(`respondByMethod: unexpected GREEN-API method "${method}"`);
    }
    if (response === "hang") return hang(init);
    return new Response(JSON.stringify(response.body), { status: response.status ?? 200 });
  });
}

/** Names of the GREEN-API methods called so far, in order. */
export function calledMethods(): string[] {
  return fetchMock.mock.calls.map(([input]) => methodOf(input));
}

type PendingCall = { resolve: (response: Response) => void; reject: (error: unknown) => void };

/**
 * Every `fetch` call waits for the test: `resolveNext(body, status?)` answers the oldest
 * pending call with `body` as JSON, `rejectNext(error)` rejects it (the client turns that into
 * `ApiError("network")`), `resolveAt(index, body, status?)` answers the pending call at
 * `index` (to answer out of order). On abort a call rejects with the signal's reason and leaves
 * the queue, like `hangUntilAbort`. `pending()` — the number of calls still waiting.
 */
export function deferFetch() {
  const queue: PendingCall[] = [];
  fetchMock.mockImplementation(
    (_, init) =>
      new Promise<Response>((resolve, reject) => {
        const call: PendingCall = { resolve, reject };
        queue.push(call);
        init?.signal?.addEventListener(
          "abort",
          () => {
            const index = queue.indexOf(call);
            if (index !== -1) queue.splice(index, 1);
            reject(init.signal!.reason);
          },
          { once: true },
        );
      }),
  );
  function next(): PendingCall {
    const call = queue.shift();
    if (!call) throw new Error("deferFetch: no pending fetch call");
    return call;
  }
  function at(index: number): PendingCall {
    const [call] = queue.splice(index, 1);
    if (!call) throw new Error(`deferFetch: no pending fetch call at ${index}`);
    return call;
  }
  return {
    resolveNext: (body: unknown, status = 200) => next().resolve(Response.json(body, { status })),
    resolveAt: (index: number, body: unknown, status = 200) =>
      at(index).resolve(Response.json(body, { status })),
    rejectNext: (error: unknown) => next().reject(error),
    pending: () => queue.length,
  };
}
