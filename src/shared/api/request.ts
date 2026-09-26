import { ApiError } from "./api-error";
import type { Credentials } from "./types";

type HttpMethod = "GET" | "POST" | "DELETE";

/** GREEN-API methods the client calls. */
type GreenApiMethod =
  | "getStateInstance"
  | "getSettings"
  | "setSettings"
  | "checkAccount"
  | "sendMessage"
  | "receiveNotification"
  | "deleteNotification";

export type RequestParams = {
  creds: Credentials;
  method: GreenApiMethod;
  httpMethod: HttpMethod;
  /** Serialized as JSON; sets `Content-Type: application/json`. */
  body?: unknown;
  query?: Record<string, number>;
  /** Extra path segment after the token, e.g. `receiptId`. */
  pathSuffix?: number;
  signal?: AbortSignal;
  /**
   * Aborts the request after this many milliseconds with a `TimeoutError` `DOMException`
   * (thrown as is, not as `ApiError`, and not an `AbortError`: a timeout is a failure).
   */
  timeout?: number;
};

function buildUrl({ creds, method, query, pathSuffix }: RequestParams): string {
  const base = creds.apiUrl.replace(/\/+$/, "");
  const id = encodeURIComponent(creds.idInstance);
  const token = encodeURIComponent(creds.apiTokenInstance);
  let url = `${base}/waInstance${id}/${method}/${token}`;
  if (pathSuffix !== undefined) {
    url += `/${pathSuffix}`;
  }
  if (query) {
    const search = new URLSearchParams(
      Object.entries(query).map(([key, value]) => [key, String(value)]),
    ).toString();
    if (search) {
      url += `?${search}`;
    }
  }
  return url;
}

function statusError(status: number): ApiError {
  if (status === 401 || status === 403) {
    return new ApiError("auth", { status });
  }
  if (status === 469) {
    return new ApiError("rate-limit", { status });
  }
  return new ApiError("http", { status });
}

/**
 * The only place that calls `fetch` for GREEN-API. Resolves with the parsed JSON body
 * (`null` for an empty body). Once the signal is aborted (or `timeout` elapses), its reason is
 * thrown as is; other failures become `ApiError`.
 */
export async function request<T>(params: RequestParams): Promise<T | null> {
  const { signal, timeout } = params;
  if (timeout === undefined) {
    return send<T>(params, signal);
  }
  // One controller for the caller's signal and the timeout, without `AbortSignal.any()` (missing
  // in Safari < 17.4 and Chrome < 116, which Vite's default target covers; no polyfills) and
  // without `AbortSignal.timeout()` (ignores fake timers in tests).
  const combined = new AbortController();
  const onAbort = () => combined.abort(signal?.reason);
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(
    () => combined.abort(new DOMException("GREEN-API: request timed out", "TimeoutError")),
    timeout,
  );
  try {
    return await send<T>(params, combined.signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function send<T>(params: RequestParams, signal: AbortSignal | undefined): Promise<T | null> {
  const { httpMethod, body } = params;
  const init: RequestInit = { method: httpMethod, signal };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  signal?.throwIfAborted();

  let response: Response;
  try {
    response = await fetch(buildUrl(params), init);
  } catch (error) {
    signal?.throwIfAborted();
    throw new ApiError("network", { cause: error });
  }

  signal?.throwIfAborted();

  if (!response.ok) {
    // The body is not used: release the connection instead of waiting for GC.
    response.body?.cancel().catch(() => undefined);
    throw statusError(response.status);
  }

  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    signal?.throwIfAborted();
    throw new ApiError("network", { status: response.status, cause: error });
  }

  if (text.trim() === "") {
    return null;
  }
  try {
    return JSON.parse(text) as T | null;
  } catch (error) {
    throw new ApiError("http", { status: response.status, cause: error });
  }
}
