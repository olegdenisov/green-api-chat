import { notifications } from "@mantine/notifications";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { activeChatIdAtom, chatsAtom } from "@/entities/chat";
import { credentialsAtom } from "@/entities/session";

import { checkAccountExists, checkAccountNotExists } from "@test/fixtures/green-api/check-account";
import { calledMethods, creds, hangUntilAbort, respondByMethod, stubFetch } from "@test/green-api";
import { render } from "@test/render";

import { CreateChatForm } from "./create-chat-form";

const phoneInput = () => screen.getByLabelText("Номер телефона");
const submitButton = () => screen.getByRole("button", { name: "Создать" });

function renderForm() {
  const result = render(<CreateChatForm />);
  result.frame.run(() => credentialsAtom.set(creds));
  return result;
}

beforeEach(stubFetch);
afterEach(() => notifications.clean());

describe("CreateChatForm", () => {
  it("creates and selects a chat on Enter and clears the field", async () => {
    respondByMethod({ checkAccount: { body: checkAccountExists } });
    const user = userEvent.setup();
    const { frame } = renderForm();

    expect(phoneInput()).toHaveAttribute("type", "tel");
    await user.type(phoneInput(), "+7 987 654-32-10{Enter}");

    await waitFor(() =>
      expect(frame.run(() => activeChatIdAtom())).toBe(checkAccountExists.chatId),
    );
    expect(frame.run(() => chatsAtom())[checkAccountExists.chatId]).toMatchObject({
      title: "@username",
      phone: "79876543210",
    });
    expect(calledMethods()).toEqual(["checkAccount"]);
    await waitFor(() => expect(phoneInput()).toHaveValue(""));
  });

  it("shows a validation error under the field without a request", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(submitButton());

    expect(await screen.findByText("Введите номер телефона")).toBeInTheDocument();
    expect(phoneInput()).toHaveAttribute("aria-invalid", "true");
    expect(calledMethods()).toEqual([]);
  });

  it("shows «not registered» under the field, keeps the number and hides it on edit", async () => {
    respondByMethod({ checkAccount: { body: checkAccountNotExists } });
    const user = userEvent.setup();
    const { frame } = renderForm();

    await user.type(phoneInput(), "79876543210");
    await user.click(submitButton());

    expect(await screen.findByText("Номер не зарегистрирован в Telegram")).toBeInTheDocument();
    expect(phoneInput()).toHaveValue("79876543210");
    expect(phoneInput()).toHaveAttribute("aria-invalid", "true");
    expect(frame.run(() => chatsAtom())).toEqual({});

    await user.type(phoneInput(), "1");
    expect(screen.queryByText("Номер не зарегистрирован в Telegram")).not.toBeInTheDocument();
  });

  it("shows the loader and disables the field while checking", async () => {
    hangUntilAbort();
    const user = userEvent.setup();
    renderForm();

    await user.type(phoneInput(), "79876543210");
    await user.click(submitButton());

    await waitFor(() => expect(submitButton()).toHaveAttribute("data-loading", "true"));
    expect(submitButton()).toBeDisabled();
    expect(phoneInput()).toBeDisabled();
  });
});
