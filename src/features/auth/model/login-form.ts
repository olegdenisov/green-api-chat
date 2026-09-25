import { notifications } from "@mantine/notifications";
import { abortVar, peek, reatomField, reatomForm, withChangeHook, wrap } from "@reatom/core";

import { credentialsAtom } from "@/entities/session";
import { createGreenApi, resolveApiUrl, type Credentials } from "@/shared/api";

import { LoginError } from "./login-error";
import { ensureNotificationSettings, SETTINGS_TOASTS } from "./notification-settings";

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

/** Only `https:`: the token is a part of the request URL. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** `apiUrl` the requests go to: the entered one (without a trailing `/`) or derived from the id. */
function effectiveApiUrl(id: string, manualUrl: string): string {
  const manual = manualUrl.trim().replace(/\/+$/, "");
  const url = manual === "" ? resolveApiUrl(id) : manual;
  // Validation guarantees a value; fail loudly here rather than request a relative URL.
  if (url === undefined) throw new Error("apiUrl is not resolved after validation");
  return url;
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
        apiUrl: effectiveApiUrl(values.idInstance, values.apiUrl),
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
        if (settings !== "ok") notifications.show(SETTINGS_TOASTS[settings]);
      } finally {
        unsubscribe();
      }
    },
  },
);

// Field change hooks. Like the field errors (`keepErrorOnChange: false`), the login error goes
// away once the user edits any field.
for (const field of [idInstance, apiTokenInstance, apiUrl]) {
  field.extend(withChangeHook(() => loginForm.submit.error.set(undefined)));
}
// The "required" error of an empty apiUrl depends on idInstance: drop it once idInstance changes.
idInstance.extend(
  withChangeHook(() => {
    if (apiUrl().trim() === "") apiUrl.validation.clearErrors();
  }),
);
