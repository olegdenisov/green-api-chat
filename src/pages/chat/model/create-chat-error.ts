import { ApiError } from "@/shared/api";

type CreateChatFailure = "not-registered" | "instance-not-ready";

/** `checkAccount` answered, but no chat can be created from the answer. */
export class CreateChatError extends Error {
  readonly reason: CreateChatFailure;

  constructor(reason: CreateChatFailure) {
    super(`Cannot create a chat: ${reason}`);
    this.name = "CreateChatError";
    this.reason = reason;
  }
}

const FAILURE_MESSAGES: Record<CreateChatFailure, string> = {
  "not-registered": "Номер не зарегистрирован в Telegram",
  "instance-not-ready": "Инстанс не готов, попробуйте позже",
};

/**
 * User-facing text for a failed chat creation. Cancellation never gets here: `withAsync`
 * does not put aborts into `submit.error()`.
 */
export function createChatErrorMessage(error: unknown): string {
  if (error instanceof CreateChatError) return FAILURE_MESSAGES[error.reason];
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "auth":
        return "Доступ запрещён. Выйдите и войдите заново";
      case "network":
        return "Нет соединения с GREEN-API";
      case "rate-limit":
        return "Слишком много проверок номеров. Попробуйте позже";
      case "http":
        if (error.status === 400) return "Неверный формат номера";
        if (error.status === 466) return "Исчерпан лимит тарифа GREEN-API";
        break;
    }
  }
  return "Не удалось проверить номер";
}
