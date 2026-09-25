import { notifications } from "@mantine/notifications";
import { context, isAbort, notify, sleep, wrap } from "@reatom/core";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { credentialsAtom } from "@/entities/session";
import { ApiError } from "@/shared/api";

import { getSettingsResponse } from "@test/fixtures/green-api/get-settings";
import { getStateInstanceResponse } from "@test/fixtures/green-api/get-state-instance";
import { setSettingsResponse } from "@test/fixtures/green-api/set-settings";
import {
  calledMethods,
  creds,
  fetchMock,
  hangUntilAbort,
  respondByMethod,
  stubFetch,
} from "@test/green-api";

import { LoginError } from "./login-error";
import { loginForm } from "./login-form";

const { fields } = loginForm;

/**
 * Types into the fields like separate user input events. Field change hooks (with
 * `keepErrorOnChange: false` they clear the field errors) are queued until the next microtask;
 * in the UI every input event flushes them long before submit, so flush them here too —
 * otherwise they run in the middle of `submit()` and wipe the fresh validation errors.
 */
function fill(values: { idInstance?: string; apiTokenInstance?: string; apiUrl?: string }) {
  if (values.idInstance !== undefined) fields.idInstance.change(values.idInstance);
  if (values.apiTokenInstance !== undefined) {
    fields.apiTokenInstance.change(values.apiTokenInstance);
  }
  if (values.apiUrl !== undefined) fields.apiUrl.change(values.apiUrl);
  notify();
}

/**
 * Submits; the rejection stays available via `submit.error()`. Returns the `wrap`-ed promise
 * itself (not an `async` wrapper), so the caller's `await` resumes in the test frame.
 */
function submit() {
  return wrap(loginForm.submit().catch(() => {}));
}

const fieldError = (field: keyof typeof fields) => fields[field].validation().error;

const ok = {
  getStateInstance: { body: getStateInstanceResponse },
  getSettings: { body: getSettingsResponse },
};

beforeEach(stubFetch);

let show: MockInstance<typeof notifications.show>;
beforeEach(() => {
  show = vi.spyOn(notifications, "show").mockReturnValue("");
});
afterEach(() => {
  show.mockRestore();
});

describe("loginForm validation", () => {
  it("requires idInstance and apiTokenInstance", async () => {
    await context.start(async () => {
      await submit();
      expect(fieldError("idInstance")).toBe("Введите idInstance (только цифры)");
      expect(fieldError("apiTokenInstance")).toBe("Введите apiTokenInstance");
      // One mistake, one message: the invalid idInstance already has an error.
      expect(fieldError("apiUrl")).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("rejects whitespace-only idInstance and apiTokenInstance", async () => {
    await context.start(async () => {
      fill({ idInstance: "   ", apiTokenInstance: "  " });
      await submit();
      expect(fieldError("idInstance")).toBe("Введите idInstance (только цифры)");
      expect(fieldError("apiTokenInstance")).toBe("Введите apiTokenInstance");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("rejects a non-numeric idInstance", async () => {
    await context.start(async () => {
      fill({ idInstance: "11a01", apiTokenInstance: "token", apiUrl: creds.apiUrl });
      await submit();
      expect(fieldError("idInstance")).toBe("Введите idInstance (только цифры)");
      expect(fieldError("apiTokenInstance")).toBeUndefined();
      expect(fieldError("apiUrl")).toBeUndefined();
    });
  });

  it("requires apiUrl when it cannot be derived from a short idInstance", async () => {
    await context.start(async () => {
      fill({ idInstance: "110", apiTokenInstance: "token" });
      await submit();
      expect(fieldError("idInstance")).toBeUndefined();
      expect(fieldError("apiUrl")).toBe("Укажите apiUrl из консоли GREEN-API");
    });
  });

  it("accepts a short idInstance with a manual apiUrl", async () => {
    respondByMethod(ok);
    await context.start(async () => {
      fill({ idInstance: "110", apiTokenInstance: "token", apiUrl: creds.apiUrl });
      await submit();
      expect(credentialsAtom()).toEqual({
        idInstance: "110",
        apiTokenInstance: "token",
        apiUrl: creds.apiUrl,
      });
    });
  });

  it("drops the apiUrl requirement error once idInstance changes", async () => {
    await context.start(async () => {
      fill({ idInstance: "110", apiTokenInstance: "token" });
      await submit();
      expect(fieldError("apiUrl")).toBe("Укажите apiUrl из консоли GREEN-API");

      fill({ idInstance: creds.idInstance });
      expect(fieldError("apiUrl")).toBeUndefined();
    });
  });

  it("does not re-validate apiUrl while idInstance is being edited", async () => {
    respondByMethod({ getStateInstance: { body: {}, status: 401 } });
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: "token" });
      await submit();

      fill({ idInstance: "" });
      fill({ idInstance: "1" });
      await wrap(sleep(0));
      expect(fieldError("apiUrl")).toBeUndefined();
    });
  });

  it.each(["ftp://host", "not a url", "http://1101.api.green-api.com"])(
    "rejects apiUrl %s (https only)",
    async (apiUrl) => {
      await context.start(async () => {
        fill({ idInstance: creds.idInstance, apiTokenInstance: "token", apiUrl });
        await submit();
        expect(fieldError("apiUrl")).toBe("Некорректный URL (нужен https://)");
        expect(fetchMock).not.toHaveBeenCalled();
      });
    },
  );

  it("clears a field error once the value changes", async () => {
    await context.start(async () => {
      await submit();
      expect(fieldError("apiTokenInstance")).toBe("Введите apiTokenInstance");

      fill({ apiTokenInstance: "t" });
      expect(fieldError("apiTokenInstance")).toBeUndefined();
      expect(fieldError("idInstance")).toBe("Введите idInstance (только цифры)");
    });
  });
});

describe("loginForm submit", () => {
  it("saves trimmed credentials with the derived apiUrl", async () => {
    respondByMethod(ok);
    await context.start(async () => {
      fill({
        idInstance: ` ${creds.idInstance} `,
        apiTokenInstance: ` ${creds.apiTokenInstance} `,
      });
      await submit();

      expect(loginForm.submit.error()).toBeUndefined();
      expect(credentialsAtom()).toEqual(creds);
      expect(calledMethods()).toEqual(["getStateInstance", "getSettings"]);
      expect(show).not.toHaveBeenCalled();
    });
  });

  it("uses a manual apiUrl without the trailing slash", async () => {
    respondByMethod(ok);
    await context.start(async () => {
      fill({
        idInstance: creds.idInstance,
        apiTokenInstance: creds.apiTokenInstance,
        apiUrl: " https://7103.api.green-api.com/ ",
      });
      await submit();

      expect(credentialsAtom()).toEqual({ ...creds, apiUrl: "https://7103.api.green-api.com" });
      expect(String(fetchMock.mock.calls[0]![0])).toMatch(
        /^https:\/\/7103\.api\.green-api\.com\/waInstance/,
      );
    });
  });

  it("clears the fields after a successful login", async () => {
    respondByMethod(ok);
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: creds.apiTokenInstance });
      await submit();

      expect(credentialsAtom()).toEqual(creds);
      expect(loginForm()).toEqual({ idInstance: "", apiTokenInstance: "", apiUrl: "" });
    });
  });

  it("does not save credentials for an unauthorized instance", async () => {
    respondByMethod({ getStateInstance: { body: { stateInstance: "notAuthorized" } } });
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: creds.apiTokenInstance });
      await submit();

      const error = loginForm.submit.error();
      expect(error).toBeInstanceOf(LoginError);
      expect((error as LoginError).state).toBe("notAuthorized");
      expect(credentialsAtom()).toBeNull();
      expect(fields.apiTokenInstance()).toBe(creds.apiTokenInstance);
    });
  });

  it("reports invalid credentials as ApiError auth", async () => {
    respondByMethod({ getStateInstance: { body: {}, status: 401 } });
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: creds.apiTokenInstance });
      await submit();

      const error = loginForm.submit.error();
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).kind).toBe("auth");
      expect(credentialsAtom()).toBeNull();
    });
  });

  it("reports a failed fetch as ApiError network", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: creds.apiTokenInstance });
      await submit();

      const error = loginForm.submit.error();
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).kind).toBe("network");
      expect(credentialsAtom()).toBeNull();
    });
  });

  it("turns on a disabled notification flag and shows a toast", async () => {
    respondByMethod({
      ...ok,
      getSettings: { body: { ...getSettingsResponse, incomingWebhook: "no" } },
      setSettings: { body: setSettingsResponse },
    });
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: creds.apiTokenInstance });
      await submit();

      expect(credentialsAtom()).toEqual(creds);
      expect(calledMethods()).toEqual(["getStateInstance", "getSettings", "setSettings"]);
      const init = fetchMock.mock.calls[2]![1];
      expect(JSON.parse(String(init?.body))).toEqual({ incomingWebhook: "yes" });
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("~5 минут") }),
      );
    });
  });

  it("mentions the cleared webhookUrl in the toast", async () => {
    respondByMethod({
      ...ok,
      getSettings: { body: { ...getSettingsResponse, webhookUrl: "https://example.com/hook" } },
      setSettings: { body: setSettingsResponse },
    });
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: creds.apiTokenInstance });
      await submit();

      expect(credentialsAtom()).toEqual(creds);
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("webhookUrl очищен") }),
      );
    });
  });

  it("clears the login error once a field changes", async () => {
    respondByMethod({ getStateInstance: { body: {}, status: 401 } });
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: creds.apiTokenInstance });
      await submit();
      expect(loginForm.submit.error()).toBeInstanceOf(ApiError);

      fill({ apiTokenInstance: "other" });
      expect(loginForm.submit.error()).toBeUndefined();
    });
  });

  it("logs in even when the settings check fails", async () => {
    respondByMethod({ ...ok, getSettings: { body: {}, status: 500 } });
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: creds.apiTokenInstance });
      await submit();

      expect(loginForm.submit.error()).toBeUndefined();
      expect(credentialsAtom()).toEqual(creds);
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Не удалось проверить настройки инстанса — входящие могут не приходить",
        }),
      );
    });
  });

  it("submit.abort() cancels the requests without an error", async () => {
    hangUntilAbort();
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: creds.apiTokenInstance });
      const pending = loginForm.submit();
      await wrap(vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()));
      const signal = fetchMock.mock.calls[0]![1]?.signal;

      loginForm.submit.abort();
      const reason: unknown = await wrap(pending.catch((error: unknown) => error));

      expect(isAbort(reason)).toBe(true);
      expect(signal?.aborted).toBe(true);
      expect(loginForm.submit.error()).toBeUndefined();
      expect(loginForm.submit.ready()).toBe(true);
      expect(credentialsAtom()).toBeNull();
    });
  });

  it("submit.abort() during the settings check does not log in", async () => {
    fetchMock.mockImplementation((input, init) => {
      if (String(input).includes("/getStateInstance/")) {
        return Promise.resolve(Response.json(getStateInstanceResponse));
      }
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      });
    });
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: creds.apiTokenInstance });
      const pending = loginForm.submit();
      await wrap(
        vi.waitFor(() => expect(calledMethods()).toEqual(["getStateInstance", "getSettings"])),
      );

      loginForm.submit.abort();
      const reason: unknown = await wrap(pending.catch((error: unknown) => error));

      expect(isAbort(reason)).toBe(true);
      expect(credentialsAtom()).toBeNull();
      expect(show).not.toHaveBeenCalled();
    });
  });

  it("a new submit cancels the one in flight", async () => {
    const other = { ...creds, idInstance: "7103000002", apiUrl: "https://7103.api.green-api.com" };
    fetchMock.mockImplementation((input, init) => {
      if (String(input).includes(`waInstance${creds.idInstance}/`)) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        });
      }
      const method = calledMethods().at(-1);
      const body = method === "getStateInstance" ? getStateInstanceResponse : getSettingsResponse;
      return Promise.resolve(Response.json(body));
    });
    await context.start(async () => {
      fill({ idInstance: creds.idInstance, apiTokenInstance: creds.apiTokenInstance });
      const first = loginForm.submit();
      await wrap(vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()));
      const firstSignal = fetchMock.mock.calls[0]![1]?.signal;

      fill({ idInstance: other.idInstance });
      await submit();
      const reason: unknown = await wrap(first.catch((error: unknown) => error));

      expect(isAbort(reason)).toBe(true);
      expect(firstSignal?.aborted).toBe(true);
      expect(credentialsAtom()).toEqual(other);
    });
  });
});
