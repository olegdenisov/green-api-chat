import { notifications } from "@mantine/notifications";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { activeChatIdAtom, chatsAtom } from "@/entities/chat";
import { credentialsAtom } from "@/entities/session";

import { checkAccountExists } from "@test/fixtures/green-api/check-account";
import { creds, respondByMethod, stubFetch } from "@test/green-api";
import { render } from "@test/render";

import { ChatPage } from "./chat-page";

const pageRoot = () => screen.getByRole("main");

beforeEach(stubFetch);
afterEach(() => notifications.clean());

describe("ChatPage", () => {
  it("renders the sidebar and the window stub", () => {
    render(<ChatPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("GREEN-API chat");
    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
    expect(screen.getByLabelText("Номер телефона")).toBeInTheDocument();
    expect(screen.getByText("Создайте чат по номеру телефона")).toBeInTheDocument();
    expect(screen.getByText("Выберите чат или создайте новый")).toBeInTheDocument();
    expect(pageRoot()).toHaveAttribute("data-view", "list");
    // The one `main` landmark also exists in the narrow list view, where the window is hidden.
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Чаты" })).toBeInTheDocument();
    // Polling is not failing: no connection strip.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("creates a chat by number: it appears in the list and opens", async () => {
    // ChatPage alone does not poll: a receiveNotification call would fail the test.
    respondByMethod({ checkAccount: { body: checkAccountExists } });
    const user = userEvent.setup();
    const { frame } = render(<ChatPage />);
    frame.run(() => credentialsAtom.set(creds));

    await user.type(screen.getByLabelText("Номер телефона"), "+7 987 654-32-10{Enter}");

    const row = await screen.findByRole("button", { name: /@username/ });
    expect(row).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("@username");
    expect(pageRoot()).toHaveAttribute("data-view", "chat");
    expect(frame.run(() => activeChatIdAtom())).toBe(checkAccountExists.chatId);
    expect(screen.getByLabelText("Номер телефона")).toHaveValue("");
  });

  it("switches data-view by the active chat", async () => {
    const user = userEvent.setup();
    const { frame } = render(<ChatPage />);
    frame.run(() => chatsAtom.set({ "1": { chatId: "1", title: "Friend", lastMessageAt: 1 } }));

    await user.click(await screen.findByRole("button", { name: /Friend/ }));
    expect(pageRoot()).toHaveAttribute("data-view", "chat");

    frame.run(() => activeChatIdAtom.set(null));
    await waitFor(() => expect(pageRoot()).toHaveAttribute("data-view", "list"));
  });

  it("returns focus to the row of the closed chat after back", async () => {
    const user = userEvent.setup();
    const { frame } = render(<ChatPage />);
    frame.run(() =>
      chatsAtom.set({
        "1": { chatId: "1", title: "Friend", lastMessageAt: 2 },
        "2": { chatId: "2", title: "Other", lastMessageAt: 1 },
      }),
    );

    await user.click(await screen.findByRole("button", { name: /Other/ }));
    await user.click(screen.getByRole("button", { name: "Назад к чатам" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Other/ })).toHaveFocus());
  });

  it("treats a dangling active chat id as no chat", () => {
    const { frame } = render(<ChatPage />);
    frame.run(() => activeChatIdAtom.set("missing"));

    expect(pageRoot()).toHaveAttribute("data-view", "list");
    expect(screen.getByText("Выберите чат или создайте новый")).toBeInTheDocument();
  });
});
