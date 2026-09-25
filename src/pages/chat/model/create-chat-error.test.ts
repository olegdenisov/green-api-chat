import { describe, expect, it } from "vitest";

import { ApiError } from "@/shared/api";

import { CreateChatError, createChatErrorMessage } from "./create-chat-error";

describe("CreateChatError", () => {
  it("keeps the reason", () => {
    const error = new CreateChatError("not-registered");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("CreateChatError");
    expect(error.reason).toBe("not-registered");
  });
});

describe("createChatErrorMessage", () => {
  it.each<[unknown, string]>([
    [new CreateChatError("not-registered"), "Номер не зарегистрирован в Telegram"],
    [new CreateChatError("instance-not-ready"), "Инстанс не готов, попробуйте позже"],
    [
      new ApiError("rate-limit", { status: 469 }),
      "Слишком много проверок номеров. Попробуйте позже",
    ],
    [new ApiError("rate-limit"), "Слишком много проверок номеров. Попробуйте позже"],
    [new ApiError("http", { status: 400 }), "Неверный формат номера"],
    [new ApiError("http", { status: 466 }), "Исчерпан лимит тарифа GREEN-API"],
    [new ApiError("auth", { status: 401 }), "Доступ запрещён. Выйдите и войдите заново"],
    [new ApiError("network"), "Нет соединения с GREEN-API"],
    [new ApiError("http", { status: 500 }), "Не удалось проверить номер"],
    [new ApiError("http"), "Не удалось проверить номер"],
    [new TypeError("boom"), "Не удалось проверить номер"],
    ["boom", "Не удалось проверить номер"],
  ])("%s", (error, message) => {
    expect(createChatErrorMessage(error)).toBe(message);
  });
});
