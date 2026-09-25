import { Button, Group, TextInput } from "@mantine/core";
import { wrap } from "@reatom/core";
import { bindField, reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import { createChatErrorMessage } from "../model/create-chat-error";
import { createChatForm } from "../model/create-chat";

/**
 * Text of the submit error. A failed validation rejects `submit` with the very error of
 * `validation.trigger` — the field already shows its message, so it is skipped by identity.
 */
function submitErrorMessage(error: Error | undefined): string | undefined {
  if (error === undefined || error === createChatForm.validation.trigger.error()) return undefined;
  return createChatErrorMessage(error);
}

/** New chat by phone number: the field and the submit error share one place under the input. */
export const CreateChatForm = reatomComponent(() => {
  const { fields, submit } = createChatForm;
  const pending = !submit.ready();
  const { error: fieldError, ...phoneProps } = bindField(fields.phone);
  // Hidden during a retry: the old error is irrelevant while the new request runs.
  const error = fieldError ?? (pending ? undefined : submitErrorMessage(submit.error()));

  return (
    <form
      noValidate
      onSubmit={wrap((event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // The rejection is kept in `submit.error()` and rendered under the field.
        createChatForm.submit().catch(() => {});
      })}
    >
      <Group align="flex-start" gap="xs" wrap="nowrap">
        <TextInput
          type="tel"
          inputMode="tel"
          autoComplete="off"
          aria-label="Номер телефона"
          placeholder="+7 999 123-45-67"
          // Not `disabled`: that drops the focus, and after an error the number is edited again.
          readOnly={pending}
          error={error}
          flex={1}
          {...phoneProps}
        />
        <Button type="submit" loading={pending}>
          Создать
        </Button>
      </Group>
    </form>
  );
}, "chatPage.CreateChatForm");
