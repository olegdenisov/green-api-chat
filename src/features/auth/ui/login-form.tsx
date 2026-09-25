import { Alert, Button, Fieldset, PasswordInput, Stack, TextInput } from "@mantine/core";
import { wrap } from "@reatom/core";
import { bindField, reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import { resolveApiUrl } from "@/shared/api";

import { loginErrorMessage } from "../model/login-error";
import { loginForm } from "../model/login-form";

const API_URL_PLACEHOLDER = "https://XXXX.api.green-api.com";

/**
 * Text for the error `Alert`. A failed validation rejects `submit` with the very error of
 * `validation.trigger` — its messages are already next to the fields, so it is skipped by
 * identity; any other error (including unexpected ones) is shown.
 */
function alertMessage(error: Error | undefined): string | null {
  if (error === undefined || error === loginForm.validation.trigger.error()) return null;
  return loginErrorMessage(error);
}

export const LoginForm = reatomComponent(() => {
  const { fields, submit } = loginForm;
  const pending = !submit.ready();
  // Hidden during a retry: the old error is irrelevant while the new request runs.
  const error = pending ? null : alertMessage(submit.error());

  return (
    <form
      noValidate
      onSubmit={wrap((event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // The rejection is kept in `submit.error()` and rendered below.
        loginForm.submit().catch(() => {});
      })}
    >
      <Stack>
        <Fieldset variant="unstyled" disabled={pending}>
          <Stack>
            <TextInput
              label="idInstance"
              autoComplete="off"
              inputMode="numeric"
              {...bindField(fields.idInstance)}
            />
            <PasswordInput
              label="apiTokenInstance"
              autoComplete="off"
              {...bindField(fields.apiTokenInstance)}
            />
            <TextInput
              label="apiUrl"
              description="Можно не заполнять"
              placeholder={resolveApiUrl(fields.idInstance()) ?? API_URL_PLACEHOLDER}
              autoComplete="off"
              {...bindField(fields.apiUrl)}
            />
          </Stack>
        </Fieldset>
        {error !== null && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Button type="submit" loading={pending} fullWidth>
          Войти
        </Button>
      </Stack>
    </form>
  );
}, "auth.LoginForm");
