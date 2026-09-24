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
  getStateInstance(opts?: RequestOptions): Promise<GetStateInstanceResponse>;
  getSettings(opts?: RequestOptions): Promise<Settings>;
  setSettings(patch: SettingsPatch, opts?: RequestOptions): Promise<SetSettingsResponse>;
  /**
   * Resolves with a result or a non-rate-limit failure reported with HTTP 200.
   * Telegram's `rate_limit_exceeded` (HTTP 200) rejects with `ApiError { kind: "rate-limit" }`.
   */
  checkAccount(phoneNumber: number, opts?: RequestOptions): Promise<CheckAccountResponse>;
  sendMessage(params: SendMessageRequest, opts?: RequestOptions): Promise<SendMessageResponse>;
  /** Resolves with `null` when the queue is empty. */
  receiveNotification(opts?: ReceiveNotificationOptions): Promise<ReceivedNotification | null>;
  deleteNotification(receiptId: number, opts?: RequestOptions): Promise<DeleteNotificationResponse>;
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
    getStateInstance: (opts) =>
      requestBody({ method: "getStateInstance", httpMethod: "GET", signal: opts?.signal }),

    getSettings: (opts) =>
      requestBody({ method: "getSettings", httpMethod: "GET", signal: opts?.signal }),

    setSettings: (patch, opts) =>
      requestBody({
        method: "setSettings",
        httpMethod: "POST",
        body: patch,
        signal: opts?.signal,
      }),

    async checkAccount(phoneNumber, opts) {
      const response = await requestBody<CheckAccountResponse>({
        method: "checkAccount",
        httpMethod: "POST",
        body: { phoneNumber },
        signal: opts?.signal,
      });
      if (isRateLimitExceeded(response)) {
        throw new ApiError("rate-limit");
      }
      return response;
    },

    sendMessage: ({ chatId, message }, opts) =>
      requestBody({
        method: "sendMessage",
        httpMethod: "POST",
        body: { chatId, message },
        signal: opts?.signal,
      }),

    receiveNotification: (opts) =>
      request<ReceivedNotification>({
        creds,
        method: "receiveNotification",
        httpMethod: "GET",
        query:
          opts?.receiveTimeout === undefined ? undefined : { receiveTimeout: opts.receiveTimeout },
        signal: opts?.signal,
      }),

    deleteNotification: (receiptId, opts) =>
      requestBody({
        method: "deleteNotification",
        httpMethod: "DELETE",
        pathSuffix: receiptId,
        signal: opts?.signal,
      }),
  };
}
