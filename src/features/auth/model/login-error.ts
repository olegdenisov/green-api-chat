import { ApiError, type StateInstance } from "@/shared/api";

type FailedState = Exclude<StateInstance, "authorized">;

/** The instance answered, but its state does not allow working with it. */
export class LoginError extends Error {
  readonly state: FailedState;

  constructor(state: FailedState) {
    super(`GREEN-API instance state: ${state}`);
    this.name = "LoginError";
    this.state = state;
  }
}

const NOT_AUTHORIZED = "Инстанс не авторизован в Telegram";
const BLOCKED = "Инстанс заблокирован или приостановлен";

const STATE_MESSAGES: Record<FailedState, string> = {
  notAuthorized: NOT_AUTHORIZED,
  pendingPassword: NOT_AUTHORIZED,
  blocked: BLOCKED,
  suspended: BLOCKED,
  starting: "Инстанс запускается, попробуйте через минуту",
};

/**
 * User-facing text for a failed login request. Cancellation never gets here: `withAsync`
 * does not put aborts into `submit.error()`.
 */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof LoginError) {
    // Responses are not validated at runtime: a state missing from the docs is possible.
    return STATE_MESSAGES[error.state] ?? NOT_AUTHORIZED;
  }
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
