import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { activeChatIdAtom, chatsAtom } from "@/entities/chat";
import { messagesAtom } from "@/entities/message";
import { credentialsAtom } from "@/entities/session";

import { sendMessageResponse } from "@test/fixtures/green-api/send-message";
import { calledMethods, creds, respondByMethod, stubFetch } from "@test/green-api";
import { render } from "@test/render";

import { Composer } from "./composer";

const input = () => screen.getByLabelText("Сообщение");
const sendButton = () => screen.getByRole("button", { name: "Отправить" });

function renderComposer() {
  const result = render(<Composer />);
  result.frame.run(() => {
    credentialsAtom.set(creds);
    chatsAtom.set({ "1": { chatId: "1", title: "Friend", lastMessageAt: 1 } });
    activeChatIdAtom.set("1");
  });
  return result;
}

beforeEach(stubFetch);

describe("Composer", () => {
  it("sends on Enter and clears the field", async () => {
    respondByMethod({ sendMessage: { body: sendMessageResponse } });
    const user = userEvent.setup();
    const { frame } = renderComposer();

    await user.type(input(), "Hello{Enter}");

    expect(input()).toHaveValue("");
    await waitFor(() =>
      expect(frame.run(() => messagesAtom()["1"])).toEqual([
        expect.objectContaining({ text: "Hello", status: "sent" }),
      ]),
    );
    expect(calledMethods()).toEqual(["sendMessage"]);
  });

  it("sends by the button", async () => {
    respondByMethod({ sendMessage: { body: sendMessageResponse } });
    const user = userEvent.setup();
    const { frame } = renderComposer();

    await user.type(input(), "Hi");
    await user.click(sendButton());

    expect(input()).toHaveValue("");
    await waitFor(() => expect(frame.run(() => messagesAtom()["1"])).toHaveLength(1));
  });

  it("does not send on the Enter that confirms an IME composition", async () => {
    const user = userEvent.setup();
    const { frame } = renderComposer();
    await user.type(input(), "こんにちは");

    // Chrome/Firefox mark it with `isComposing`, Safari only with `keyCode` 229. `fireEvent`:
    // `userEvent` cannot produce a composing keydown.
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 229 });

    expect(input()).toHaveValue("こんにちは");
    expect(frame.run(() => messagesAtom()["1"])).toBeUndefined();
    expect(calledMethods()).toEqual([]);
  });

  it("inserts a line break on Shift+Enter without sending", async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(input(), "one{Shift>}{Enter}{/Shift}two");

    expect(input()).toHaveValue("one\ntwo");
    expect(calledMethods()).toEqual([]);
  });

  it("disables the button for blank text and ignores Enter", async () => {
    const user = userEvent.setup();
    const { frame } = renderComposer();

    expect(sendButton()).toBeDisabled();
    await user.type(input(), "   ");
    expect(sendButton()).toBeDisabled();
    await user.type(input(), "{Enter}");

    expect(frame.run(() => messagesAtom())).toEqual({});
    expect(calledMethods()).toEqual([]);

    await user.type(input(), "x");
    expect(sendButton()).toBeEnabled();
  });

  it("limits the text to 4096 characters", () => {
    renderComposer();

    expect(input()).toHaveAttribute("maxLength", "4096");
  });
});
