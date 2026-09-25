import { abortVar, reatomField, reatomForm, withChangeHook, wrap } from "@reatom/core";

import { findChatByPhone, openChat } from "@/entities/chat";
import { greenApiAtom, requireApi } from "@/entities/session";

import { CreateChatError } from "./create-chat-error";

/** Digits only: drops spaces, `+`, `-`, brackets. A leading `8` is kept as is. */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

const phone = reatomField("", {
  name: "chatPage.createChatForm.phone",
  validate: ({ state }) => {
    const digits = normalizePhone(state);
    if (digits === "") return "Введите номер телефона";
    if (digits.length < 10 || digits.length > 15) {
      return "Номер — от 10 до 15 цифр в международном формате";
    }
    return undefined;
  },
});

/**
 * A new chat by phone number. A chat already known by this number opens without a request
 * (saves the Telegram check limit); otherwise `checkAccount` resolves the `chatId`. A new
 * submit or `submit.abort()` cancels the request in flight.
 */
export const createChatForm = reatomForm(
  { phone },
  {
    name: "chatPage.createChatForm",
    keepErrorOnChange: false,
    // Only after a successful submit: on an error the number stays for editing.
    resetOnSubmit: true,
    onSubmit: async (values) => {
      const number = normalizePhone(values.phone);

      const known = findChatByPhone(number);
      if (known) {
        openChat(known);
        return;
      }

      const api = requireApi();
      const { controller, unsubscribe } = abortVar.subscribe();
      try {
        const response = await wrap(
          api.checkAccount(Number(number), { signal: controller.signal }),
        );
        // Logout does not cancel requests in flight: drop a late answer for the old session.
        if (greenApiAtom() !== api) return;

        if (!("exist" in response)) throw new CreateChatError("instance-not-ready");
        if (!response.exist) throw new CreateChatError("not-registered");

        openChat({
          chatId: response.chatId,
          // `||`: an empty `username` is no title either.
          title: response.username || `+${number}`,
          phone: number,
          lastMessageAt: Date.now(),
        });
      } catch (error) {
        // A late failure for the old session is dropped as well.
        if (greenApiAtom() !== api) return;
        throw error;
      } finally {
        unsubscribe();
      }
    },
  },
);

// Like the field error (`keepErrorOnChange: false`), the submit error goes away on edit.
phone.extend(withChangeHook(() => createChatForm.submit.error.set(undefined)));
