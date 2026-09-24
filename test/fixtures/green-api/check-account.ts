// https://green-api.com/telegram/docs/api/service/CheckAccount/
import type { CheckAccountFailure, CheckAccountRequest, CheckAccountResult } from "@/shared/api";

export const checkAccountRequest = {
  phoneNumber: 79876543210,
} satisfies CheckAccountRequest;

export const checkAccountExists = {
  exist: true,
  chatId: "10000000",
  username: "@username",
  phoneNumber: 79876543210,
  fromCache: true,
} satisfies CheckAccountResult;

export const checkAccountNotExists = {
  exist: false,
  chatId: "",
} satisfies CheckAccountResult;

/** HTTP 200 with Telegram's rate limit. */
export const checkAccountRateLimitExceeded = {
  status: false,
  data: {
    status: "fail",
    reason: "rate_limit_exceeded",
    retryAfter: 11930619,
  },
} satisfies CheckAccountFailure;

export const checkAccountInstanceNotReady = {
  status: false,
  reason: "instance is starting or not authorized",
} satisfies CheckAccountFailure;

/** HTTP 469 body. */
export const checkAccountRateLimitedByMessenger = {
  status: false,
  reason: "Rate limited by messenger",
} satisfies CheckAccountFailure;
