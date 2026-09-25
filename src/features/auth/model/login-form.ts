import { notifications } from "@mantine/notifications";
import { abortVar, peek, reatomField, reatomForm, withChangeHook, wrap } from "@reatom/core";

import { credentialsAtom } from "@/entities/session";
import { createGreenApi, resolveApiUrl } from "@/shared/api";
import type { Credentials } from "@/shared/api";

import { LoginError } from "./login-error";
import { ensureNotificationSettings } from "./notification-settings";

// Created before the form: the `apiUrl` validator reads it, and `loginForm.fields` does not
// exist yet while the fields are declared.
const idInstance = reatomField("", {
  name: "auth.loginForm.idInstance",
  validate: ({ state }) => (isIdInstance(state) ? undefined : "Введите idInstance (только цифры)"),
});

function isIdInstance(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

const apiTokenInstance = reatomField("", {
  name: "auth.loginForm.apiTokenInstance",
  validate: ({ state }) => (state.trim() === "" ? "Введите apiTokenInstance" : undefined),
});

const apiUrl = reatomField("", {
  name: "auth.loginForm.apiUrl",
  validate: ({ state }) => {
    const value = state.trim();
    if (value === "") {
      // `peek`: Reatom runs the validator in an effect, and a tracked `idInstance()` would
      // re-validate this field on every keystroke in idInstance. An invalid idInstance has
      // its own error — one mistake, one message.
      const id = peek(idInstance);
      return isIdInstance(id) && resolveApiUrl(id) === undefined
        ? "Укажите apiUrl из консоли GREEN-API"
        : undefined;
    }
    return isHttpsUrl(value) ? undefined : "Некорректный URL (нужен https://)";
  },
});

// The "required" error of an empty apiUrl depends on idInstance: drop it once idInstance changes.
idInstance.extend(
  withChangeHook(() => {
    if (apiUrl().trim() === "") apiUrl.validation.clearErrors();
  }),
);

/** Only `https:`: the token is a part of the request URL. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** `apiUrl` the requests go to: the entered one (without a trailing `/`) or derived from the id. */
function effectiveApiUrl(idInstance: string, apiUrl: string): string | undefined {
  const manual = apiUrl.trim().replace(/\/+$/, "");
  return manual === "" ? resolveApiUrl(idInstance) : manual;
}

/**
 * Login: checks the instance, turns on notification settings, then saves the credentials
 * (the app switches to the chat screen by itself). A new submit or `submit.abort()` cancels
 * the requests in flight.
 */
export const loginForm = reatomForm(
  { idInstance, apiTokenInstance, apiUrl },
  {
    name: "auth.loginForm",
    keepErrorOnChange: false,
    // Do not keep the token in the form state after login.
    resetOnSubmit: true,
    onSubmit: async (values) => {
      const creds: Credentials = {
        idInstance: values.idInstance.trim(),
        apiTokenInstance: values.apiTokenInstance.trim(),
        // Validation guarantees a value: either a manual URL or a derivable one.
        apiUrl: effectiveApiUrl(values.idInstance, values.apiUrl) ?? "",
      };
      const api = createGreenApi(creds);

      const { controller, unsubscribe } = abortVar.subscribe();
      try {
        const { signal } = controller;
        const { stateInstance } = await wrap(api.getStateInstance({ signal }));
        if (stateInstance !== "authorized") throw new LoginError(stateInstance);

        const settings = await wrap(ensureNotificationSettings(api, { signal }));
        credentialsAtom.set(creds);

        // Shown from the model: the form unmounts as soon as the credentials are saved.
        if (settings === "updated" || settings === "webhookCleared") {
          notifications.show({
            color: "green",
            message:
              settings === "webhookCleared"
                ? "Настройки инстанса обновлены, webhookUrl очищен: уведомления теперь читает этот чат. Входящие сообщения начнут приходить в течение ~5 минут"
                : "Настройки инстанса обновлены. Входящие сообщения начнут приходить в течение ~5 минут",
          });
        } else if (settings === "failed") {
          notifications.show({
            color: "yellow",
            message: "Не удалось проверить настройки инстанса — входящие могут не приходить",
          });
        }
      } finally {
        unsubscribe();
      }
    },
  },
);

// Like the field errors (`keepErrorOnChange: false`), the login error goes away once the user
// edits any field.
for (const field of [idInstance, apiTokenInstance, apiUrl]) {
  field.extend(withChangeHook(() => loginForm.submit.error.set(undefined)));
}
