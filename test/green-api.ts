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

/** `fetch` never settles on its own and rejects with the signal's reason on abort. */
export function hangUntilAbort() {
  fetchMock.mockImplementation(
    (_, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      }),
  );
}

type MethodResponse = { body: unknown; status?: number };

/** GREEN-API method name from a request URL: `.../waInstance{id}/{method}/{token}`. */
function methodOf(input: Parameters<typeof fetch>[0]): string {
  const url = input instanceof Request ? input.url : String(input);
  return new URL(url).pathname.split("/").at(-2) ?? "";
}

/**
 * Answers by the GREEN-API method name from the URL: `body` as JSON with `status` (200 by
 * default). A method missing from `responses` rejects the request and fails the test when it
 * finishes — the client would otherwise turn the rejection into `ApiError("network")`.
 * Call inside a test (uses `onTestFinished`).
 */
export function respondByMethod(responses: Partial<Record<string, MethodResponse>>) {
  const unexpected: string[] = [];
  onTestFinished(() => {
    if (unexpected.length > 0) {
      throw new Error(`respondByMethod: unexpected GREEN-API calls: ${unexpected.join(", ")}`);
    }
  });
  fetchMock.mockImplementation(async (input) => {
    const method = methodOf(input);
    const response = responses[method];
    if (!response) {
      unexpected.push(method);
      throw new Error(`respondByMethod: unexpected GREEN-API method "${method}"`);
    }
    return new Response(JSON.stringify(response.body), { status: response.status ?? 200 });
  });
}

/** Names of the GREEN-API methods called so far, in order. */
export function calledMethods(): string[] {
  return fetchMock.mock.calls.map(([input]) => methodOf(input));
}
