import { isAbort } from "@reatom/core";

import { ApiError } from "@/shared/api";
import type { StateInstance } from "@/shared/api";

/** The instance answered, but its state does not allow working with it. */
export class LoginError extends Error {
  readonly state: StateInstance;

  constructor(state: StateInstance) {
    super(`GREEN-API instance state: ${state}`);
    this.name = "LoginError";
    this.state = state;
  }
}

const STATE_MESSAGES: Record<StateInstance, string> = {
  notAuthorized: "Инстанс не авторизован в Telegram",
  pendingPassword: "Инстанс не авторизован в Telegram",
  blocked: "Инстанс заблокирован или приостановлен",
  suspended: "Инстанс заблокирован или приостановлен",
  starting: "Инстанс запускается, попробуйте через минуту",
  authorized: "Не удалось войти",
};

/** User-facing text for a login failure; `null` for a cancelled login. */
export function loginErrorMessage(error: unknown): string | null {
  if (isAbort(error)) return null;
  if (error instanceof LoginError) return STATE_MESSAGES[error.state];
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "auth":
        return "Неверный idInstance или apiTokenInstance";
      case "network":
        return "Нет связи с GREEN-API. Проверьте apiUrl и подключение";
      case "rate-limit":
        return "Слишком много запросов, попробуйте позже";
      case "http":
        return error.status === undefined
          ? "Некорректный ответ GREEN-API"
          : `Ошибка GREEN-API (HTTP ${error.status})`;
    }
  }
  return "Не удалось войти";
}
