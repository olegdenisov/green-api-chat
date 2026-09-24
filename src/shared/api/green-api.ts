import { ApiError } from "./api-error";
import { request, type RequestParams } from "./request";
import type {
  CheckAccountResponse,
  Credentials,
  DeleteNotificationResponse,
  GetStateInstanceResponse,
  ReceivedNotification,
  SendMessageRequest,
  SendMessageResponse,
  SetSettingsResponse,
  Settings,
  SettingsPatch,
} from "./types";

export type RequestOptions = {
  signal?: AbortSignal;
};

export type ReceiveNotificationOptions = RequestOptions & {
  /** Long-polling timeout, seconds (server default: 5). */
  receiveTimeout?: number;
};

/** GREEN-API client bound to one set of credentials. Stateless: recreate on credential change. */
export type GreenApi = {
  getStateInstance(options?: RequestOptions): Promise<GetStateInstanceResponse>;
  getSettings(options?: RequestOptions): Promise<Settings>;
  setSettings(patch: SettingsPatch, options?: RequestOptions): Promise<SetSettingsResponse>;
  /**
   * Resolves with a result or a non-rate-limit failure reported with HTTP 200.
   * Telegram's `rate_limit_exceeded` (HTTP 200) rejects with `ApiError { kind: "rate-limit" }`
   * without `status`; the raw `CheckAccountFailure` (with `data.retryAfter`) is its `cause`.
   * @param phoneNumber International format, digits only.
   */
  checkAccount(phoneNumber: number, options?: RequestOptions): Promise<CheckAccountResponse>;
  sendMessage(params: SendMessageRequest, options?: RequestOptions): Promise<SendMessageResponse>;
  /** Resolves with `null` when the queue is empty. */
  receiveNotification(options?: ReceiveNotificationOptions): Promise<ReceivedNotification | null>;
  deleteNotification(
    receiptId: number,
    options?: RequestOptions,
  ): Promise<DeleteNotificationResponse>;
};

function isRateLimitExceeded(response: CheckAccountResponse): boolean {
  return (
    "status" in response &&
    response.status === false &&
    response.data?.reason === "rate_limit_exceeded"
  );
}

export function createGreenApi(creds: Credentials): GreenApi {
  /** For methods that always return a body: an empty 2xx body is an unexpected response. */
  async function requestBody<T>(params: Omit<RequestParams, "creds">): Promise<T> {
    const result = await request<T>({ ...params, creds });
    if (result === null) {
      throw new ApiError("http");
    }
    return result;
  }

  return {
    getStateInstance: (options) =>
      requestBody({ method: "getStateInstance", httpMethod: "GET", signal: options?.signal }),

    getSettings: (options) =>
      requestBody({ method: "getSettings", httpMethod: "GET", signal: options?.signal }),

    setSettings: (patch, options) =>
      requestBody({
        method: "setSettings",
        httpMethod: "POST",
        body: patch,
        signal: options?.signal,
      }),

    checkAccount: async (phoneNumber, options) => {
      const response = await requestBody<CheckAccountResponse>({
        method: "checkAccount",
        httpMethod: "POST",
        body: { phoneNumber },
        signal: options?.signal,
      });
      if (isRateLimitExceeded(response)) {
        // Raw failure in `cause`: `data.retryAfter` tells how long to wait.
        throw new ApiError("rate-limit", { cause: response });
      }
      return response;
    },

    sendMessage: ({ chatId, message }, options) =>
      requestBody({
        method: "sendMessage",
        httpMethod: "POST",
        body: { chatId, message },
        signal: options?.signal,
      }),

    receiveNotification: (options) =>
      request<ReceivedNotification>({
        creds,
        method: "receiveNotification",
        httpMethod: "GET",
        query:
          options?.receiveTimeout === undefined
            ? undefined
            : { receiveTimeout: options.receiveTimeout },
        signal: options?.signal,
      }),

    deleteNotification: (receiptId, options) =>
      requestBody({
        method: "deleteNotification",
        httpMethod: "DELETE",
        pathSuffix: receiptId,
        signal: options?.signal,
      }),
  };
}
