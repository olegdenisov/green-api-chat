import { notifications } from "@mantine/notifications";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { activeChatIdAtom } from "@/entities/chat";
import { credentialsAtom } from "@/entities/session";

import { checkAccountExists, checkAccountNotExists } from "@test/fixtures/green-api/check-account";
import { creds, fetchMock, hangUntilAbort, respondByMethod, stubFetch } from "@test/green-api";
import { render } from "@test/render";

import { createChatForm, createChatOpenAtom } from "../model/create-chat";
import { Sidebar } from "./sidebar";

const plus = () => screen.getByRole("button", { name: "Новый чат" });
const phoneInput = () => screen.getByLabelText("Номер телефона");
const queryPhoneInput = () => screen.queryByLabelText("Номер телефона");

function renderSidebar() {
  const result = render(<Sidebar />);
  result.frame.run(() => credentialsAtom.set(creds));
  return result;
}

beforeEach(stubFetch);
afterEach(() => notifications.clean());

describe("Sidebar", () => {
  it("shows the app title as the page heading", () => {
    render(<Sidebar />);

    expect(screen.getByRole("heading", { level: 1, name: "GREEN-API chat" })).toBeInTheDocument();
  });

  it("has the logout button, the closed new-chat form and the chats navigation", () => {
    render(<Sidebar />);

    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
    expect(plus()).toHaveAttribute("aria-expanded", "false");
    expect(queryPhoneInput()).not.toBeInTheDocument();
    // The controlled wrapper exists while closed.
    const controls = plus().getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls!)).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Чаты" });
    expect(nav).toHaveTextContent("Нажмите «+», чтобы начать чат по номеру телефона");
  });

  it("appends the given class name", () => {
    render(<Sidebar className="extra" />);

    expect(screen.getByRole("complementary")).toHaveClass("extra");
  });

  it("the + opens the form and focuses the phone field", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(plus());

    expect(plus()).toHaveAttribute("aria-expanded", "true");
    expect(phoneInput()).toHaveFocus();
    expect(document.getElementById(plus().getAttribute("aria-controls")!)).toContainElement(
      phoneInput(),
    );
  });

  it("the + again closes the form and clears the number", async () => {
    const user = userEvent.setup();
    const { frame } = renderSidebar();

    await user.click(plus());
    await user.type(phoneInput(), "79991234567");
    await user.click(plus());

    expect(plus()).toHaveAttribute("aria-expanded", "false");
    expect(queryPhoneInput()).not.toBeInTheDocument();
    expect(plus()).toHaveFocus();
    expect(frame.run(() => createChatForm.fields.phone())).toBe("");

    await user.click(plus());
    expect(phoneInput()).toHaveValue("");
  });

  it("Escape closes the form, returns the focus to the + and cancels the request", async () => {
    hangUntilAbort();
    const user = userEvent.setup();
    const { frame } = renderSidebar();

    await user.click(plus());
    await user.type(phoneInput(), "79876543210{Enter}");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const signal = fetchMock.mock.calls[0]![1]?.signal;

    await user.keyboard("{Escape}");

    expect(plus()).toHaveAttribute("aria-expanded", "false");
    expect(queryPhoneInput()).not.toBeInTheDocument();
    expect(plus()).toHaveFocus();
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(frame.run(() => createChatForm.submit.ready())).toBe(true));
    expect(frame.run(() => createChatForm.submit.error())).toBeUndefined();
  });

  it("Escape outside the form (on the +) leaves the form open with the number", async () => {
    const user = userEvent.setup();
    const { frame } = renderSidebar();

    await user.click(plus());
    await user.type(phoneInput(), "79876543210");
    plus().focus();
    await user.keyboard("{Escape}");

    expect(plus()).toHaveAttribute("aria-expanded", "true");
    expect(phoneInput()).toHaveValue("79876543210");
    expect(frame.run(() => createChatOpenAtom())).toBe(true);
  });

  it("keeps the form open with the error and the number after a failed submit", async () => {
    respondByMethod({ checkAccount: { body: checkAccountNotExists } });
    const user = userEvent.setup();
    const { frame } = renderSidebar();

    await user.click(plus());
    await user.type(phoneInput(), "79876543210{Enter}");

    expect(await screen.findByText("Номер не зарегистрирован в Telegram")).toBeInTheDocument();
    expect(plus()).toHaveAttribute("aria-expanded", "true");
    expect(phoneInput()).toHaveValue("79876543210");
    expect(frame.run(() => createChatOpenAtom())).toBe(true);
  });

  it("closes the form after a successful submit", async () => {
    respondByMethod({ checkAccount: { body: checkAccountExists } });
    const user = userEvent.setup();
    const { frame } = renderSidebar();

    await user.click(plus());
    await user.type(phoneInput(), "79876543210{Enter}");

    await waitFor(() => expect(plus()).toHaveAttribute("aria-expanded", "false"));
    expect(queryPhoneInput()).not.toBeInTheDocument();
    expect(frame.run(() => activeChatIdAtom())).toBe(checkAccountExists.chatId);
  });
});
