import { ActionIcon, Textarea } from "@mantine/core";
import { wrap } from "@reatom/core";
import { bindField, reatomComponent } from "@reatom/react";
import type { KeyboardEvent, SubmitEvent } from "react";

import { IconArrowUp } from "@/shared/ui";

import { draftField, sendDraft } from "../model/draft";

import classes from "./composer.module.css";

/** Telegram's limit for a text message. */
const MAX_LENGTH = 4096;

/** Message input: `Enter` sends, `Shift+Enter` is a line break, IME composition is left alone. */
export const Composer = reatomComponent(() => {
  const blank = draftField().trim() === "";

  return (
    <form
      className={classes.composer}
      onSubmit={wrap((event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        sendDraft();
      })}
    >
      <div className={classes.pill}>
        <Textarea
          aria-label="Сообщение"
          data-composer-input
          placeholder="Напишите сообщение…"
          variant="unstyled"
          autosize
          minRows={1}
          maxRows={6}
          maxLength={MAX_LENGTH}
          flex={1}
          {...bindField(draftField)}
          onKeyDown={wrap((event: KeyboardEvent<HTMLTextAreaElement>) => {
            // Safari sends the Enter that confirms an IME composition with `isComposing: false`
            // but `keyCode` 229.
            const composing = event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
            if (event.key !== "Enter" || event.shiftKey || composing) return;
            event.preventDefault();
            sendDraft();
          })}
        />
        <ActionIcon
          type="submit"
          size={40}
          radius={14}
          variant="filled"
          aria-label="Отправить"
          disabled={blank}
          className={classes.send}
        >
          <IconArrowUp size={20} />
        </ActionIcon>
      </div>
    </form>
  );
}, "chatPage.Composer");
