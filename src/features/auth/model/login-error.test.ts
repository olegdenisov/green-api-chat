import { describe, expect, it } from "vitest";

import { ApiError } from "@/shared/api";
import type { StateInstance } from "@/shared/api";

import { LoginError, loginErrorMessage } from "./login-error";

describe("LoginError", () => {
  it("keeps the instance state", () => {
    const error = new LoginError("blocked");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("LoginError");
    expect(error.state).toBe("blocked");
  });
});

describe("loginErrorMessage", () => {
  it.each<[StateInstance, string]>([
    ["notAuthorized", "Инстанс не авторизован в Telegram"],
    ["pendingPassword", "Инстанс не авторизован в Telegram"],
    ["blocked", "Инстанс заблокирован или приостановлен"],
    ["suspended", "Инстанс заблокирован или приостановлен"],
    ["starting", "Инстанс запускается, попробуйте через минуту"],
  ])("LoginError %s", (state, message) => {
    expect(loginErrorMessage(new LoginError(state))).toBe(message);
  });

  it.each<[ApiError, string]>([
    [new ApiError("auth", { status: 401 }), "Неверный idInstance или apiTokenInstance"],
    [new ApiError("network"), "Нет связи с GREEN-API. Проверьте apiUrl и подключение"],
    [new ApiError("rate-limit", { status: 469 }), "Слишком много запросов, попробуйте позже"],
    [new ApiError("http", { status: 500 }), "Ошибка GREEN-API (HTTP 500)"],
    [new ApiError("http"), "Некорректный ответ GREEN-API"],
  ])("ApiError %s", (error, message) => {
    expect(loginErrorMessage(error)).toBe(message);
  });

  it("falls back to a generic text for unknown errors", () => {
    expect(loginErrorMessage(new Error("boom"))).toBe("Не удалось войти");
    expect(loginErrorMessage("boom")).toBe("Не удалось войти");
  });

  it("returns null for a cancelled login", () => {
    const controller = new AbortController();
    controller.abort();
    expect(loginErrorMessage(controller.signal.reason)).toBeNull();
  });
});
