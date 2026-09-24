export type ApiErrorKind = "auth" | "network" | "rate-limit" | "http";

type ApiErrorOptions = {
  status?: number;
  cause?: unknown;
};

const MESSAGES: Record<ApiErrorKind, string> = {
  auth: "GREEN-API: authorization failed, check idInstance and apiTokenInstance",
  network: "GREEN-API: network request failed",
  "rate-limit": "GREEN-API: rate limit exceeded",
  http: "GREEN-API: unexpected response",
};

/**
 * Error of a GREEN-API request. The message is a fixed string by `kind`/`status`:
 * it never contains the request URL or the token.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, options: ApiErrorOptions = {}) {
    const { status, cause } = options;
    super(status === undefined ? MESSAGES[kind] : `${MESSAGES[kind]} (HTTP ${status})`, {
      cause,
    });
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}
