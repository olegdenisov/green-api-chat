import { ApiError } from "./api-error";
import type { Credentials } from "./types";

export type HttpMethod = "GET" | "POST" | "DELETE";

export type RequestParams = {
  creds: Credentials;
  /** GREEN-API method name, e.g. `getStateInstance`. */
  method: string;
  httpMethod: HttpMethod;
  /** Serialized as JSON; sets `Content-Type: application/json`. */
  body?: unknown;
  query?: Record<string, number>;
  /** Extra path segment after the token, e.g. `receiptId`. */
  pathSuffix?: number;
  signal?: AbortSignal;
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
 * (`null` for an empty body). Once the signal is aborted, its reason is thrown as is;
 * other failures become `ApiError`.
 */
export async function request<T>(params: RequestParams): Promise<T | null> {
  const { httpMethod, body, signal } = params;
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
