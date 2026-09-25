import { Button, Textarea } from "@mantine/core";
import { wrap } from "@reatom/core";
import { bindField, reatomComponent } from "@reatom/react";
import type { FormEvent, KeyboardEvent } from "react";

import { draftField, sendDraft } from "../model/send-message";

import classes from "./composer.module.css";

/** Telegram's limit for a text message. */
const MAX_LENGTH = 4096;

/** Message input: `Enter` sends, `Shift+Enter` is a line break, IME composition is left alone. */
export const Composer = reatomComponent(() => {
  const blank = draftField().trim() === "";

  return (
    <form
      className={classes.composer}
      onSubmit={wrap((event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        sendDraft();
      })}
    >
      <Textarea
        aria-label="Сообщение"
        placeholder="Сообщение"
        autosize
        minRows={1}
        maxRows={6}
        maxLength={MAX_LENGTH}
        flex={1}
        {...bindField(draftField)}
        onKeyDown={wrap((event: KeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          sendDraft();
        })}
      />
      <Button type="submit" disabled={blank}>
        Отправить
      </Button>
    </form>
  );
}, "chat.Composer");
