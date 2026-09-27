import { notifications } from "@mantine/notifications";
import { context } from "@reatom/core";
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

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Чаты");
    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Новый чат" })).toBeInTheDocument();
    expect(
      screen.getByText("Нажмите «+», чтобы начать чат по номеру телефона"),
    ).toBeInTheDocument();
    expect(screen.getByText("Выберите чат или создайте новый")).toBeInTheDocument();
    expect(pageRoot()).toHaveAttribute("data-view", "list");
    // The one `main` landmark also exists in the narrow list view, where the window is hidden.
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Чаты" })).toBeInTheDocument();
    // Polling is not failing: no connection strip.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("creates a chat by number: it appears in the list, opens and gets the focus", async () => {
    // ChatPage alone does not poll: a receiveNotification call would fail the test.
    respondByMethod({ checkAccount: { body: checkAccountExists } });
    const user = userEvent.setup();
    const { frame } = render(<ChatPage />);
    frame.run(() => credentialsAtom.set(creds));

    await user.click(screen.getByRole("button", { name: "Новый чат" }));
    await user.type(screen.getByLabelText("Номер телефона"), "+7 987 654-32-10{Enter}");

    const row = await screen.findByRole("button", { name: /@username/ });
    expect(row).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("@username");
    expect(pageRoot()).toHaveAttribute("data-view", "chat");
    expect(frame.run(() => activeChatIdAtom())).toBe(checkAccountExists.chatId);
    // The form closed with the field that had the focus: the message input gets it.
    expect(screen.queryByLabelText("Номер телефона")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Новый чат" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await waitFor(() => expect(screen.getByLabelText("Сообщение")).toHaveFocus());
  });

  it("opens a chat known by number without a request and focuses the message input", async () => {
    // Any fetch fails the test: a known number is not checked.
    respondByMethod({});
    const user = userEvent.setup();
    const { frame } = render(<ChatPage />);
    frame.run(() => {
      credentialsAtom.set(creds);
      chatsAtom.set({
        "1": { chatId: "1", title: "Friend", phone: "79876543210", lastMessageAt: 2 },
      });
    });

    await user.click(screen.getByRole("button", { name: "Новый чат" }));
    await user.type(screen.getByLabelText("Номер телефона"), "+7 987 654-32-10{Enter}");

    await waitFor(() => expect(frame.run(() => activeChatIdAtom())).toBe("1"));
    expect(screen.queryByLabelText("Номер телефона")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Сообщение")).toHaveFocus());
  });

  it("focuses the message input after a submit of the number of the chat already open", async () => {
    respondByMethod({});
    const user = userEvent.setup();
    const { frame } = render(<ChatPage />);
    frame.run(() => {
      credentialsAtom.set(creds);
      chatsAtom.set({
        "1": { chatId: "1", title: "Friend", phone: "79876543210", lastMessageAt: 2 },
      });
    });
    await user.click(await screen.findByRole("button", { name: /Friend/ }));

    await user.click(screen.getByRole("button", { name: "Новый чат" }));
    await user.type(screen.getByLabelText("Номер телефона"), "79876543210{Enter}");

    // The active chat does not change; only the form closes with the focused field.
    await waitFor(() => expect(screen.queryByLabelText("Номер телефона")).not.toBeInTheDocument());
    expect(frame.run(() => activeChatIdAtom())).toBe("1");
    await waitFor(() => expect(screen.getByLabelText("Сообщение")).toHaveFocus());
  });

  it("moves the focus to the message input when the clicked row is hidden (narrow screen)", async () => {
    // jsdom has no layout and no `checkVisibility`: emulate the narrow-screen CSS, where the
    // list column of `data-view="chat"` gets `display: none`.
    Object.defineProperty(Element.prototype, "checkVisibility", {
      configurable: true,
      value(this: Element) {
        return this.closest('main[data-view="chat"] aside') === null;
      },
    });
    try {
      const user = userEvent.setup();
      const { frame } = render(<ChatPage />);
      frame.run(() => chatsAtom.set({ "1": { chatId: "1", title: "Friend", lastMessageAt: 1 } }));

      await user.click(await screen.findByRole("button", { name: /Friend/ }));

      await waitFor(() => expect(screen.getByLabelText("Сообщение")).toHaveFocus());
    } finally {
      Reflect.deleteProperty(Element.prototype, "checkVisibility");
    }
  });

  it("keeps the focus on a clicked chat row", async () => {
    const user = userEvent.setup();
    const { frame } = render(<ChatPage />);
    frame.run(() => chatsAtom.set({ "1": { chatId: "1", title: "Friend", lastMessageAt: 1 } }));

    const row = await screen.findByRole("button", { name: /Friend/ });
    await user.click(row);

    expect(pageRoot()).toHaveAttribute("data-view", "chat");
    expect(row).toHaveFocus();
  });

  it("does not focus the message input for a chat already open at mount", () => {
    // A previous page load left the chat open (persisted to localStorage).
    context.start(() => {
      chatsAtom.set({ "1": { chatId: "1", title: "Friend", lastMessageAt: 1 } });
      activeChatIdAtom.set("1");
    });

    render(<ChatPage />);

    expect(pageRoot()).toHaveAttribute("data-view", "chat");
    expect(screen.getByLabelText("Сообщение")).not.toHaveFocus();
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

  it("returns focus to the chats nav when the open chat is deleted (its row is also gone)", async () => {
    const user = userEvent.setup();
    const { frame } = render(<ChatPage />);
    frame.run(() =>
      chatsAtom.set({
        "1": { chatId: "1", title: "Friend", lastMessageAt: 2 },
        "2": { chatId: "2", title: "Other", lastMessageAt: 1 },
      }),
    );

    await user.click(await screen.findByRole("button", { name: /Other/ }));
    await user.click(screen.getByRole("button", { name: "Удалить чат" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(screen.getByRole("navigation", { name: "Чаты" })).toHaveFocus());
  });

  it("does not steal focus when a chat closes while focus is elsewhere (e.g. another tab)", async () => {
    const user = userEvent.setup();
    const { frame } = render(<ChatPage />);
    frame.run(() => chatsAtom.set({ "1": { chatId: "1", title: "Friend", lastMessageAt: 1 } }));

    await user.click(await screen.findByRole("button", { name: /Friend/ }));
    const newChat = screen.getByRole("button", { name: "Новый чат" });
    newChat.focus();
    expect(newChat).toHaveFocus();

    // Not a click on "Назад" or "Удалить": e.g. the chat is removed from another tab.
    frame.run(() => activeChatIdAtom.set(null));
    await waitFor(() => expect(pageRoot()).toHaveAttribute("data-view", "list"));

    expect(newChat).toHaveFocus();
  });

  it("does not steal focus when a chat opens while focus is elsewhere", async () => {
    const { frame } = render(<ChatPage />);
    frame.run(() => chatsAtom.set({ "1": { chatId: "1", title: "Friend", lastMessageAt: 1 } }));
    const newChat = screen.getByRole("button", { name: "Новый чат" });
    newChat.focus();

    frame.run(() => activeChatIdAtom.set("1"));
    await waitFor(() => expect(pageRoot()).toHaveAttribute("data-view", "chat"));

    expect(newChat).toHaveFocus();
  });

  it("focuses the message input when a chat opens with the focus lost", async () => {
    const { frame } = render(<ChatPage />);
    frame.run(() => chatsAtom.set({ "1": { chatId: "1", title: "Friend", lastMessageAt: 1 } }));
    expect(document.body).toHaveFocus();

    frame.run(() => activeChatIdAtom.set("1"));

    await waitFor(() => expect(screen.getByLabelText("Сообщение")).toHaveFocus());
  });

  it("treats a dangling active chat id as no chat", () => {
    const { frame } = render(<ChatPage />);
    frame.run(() => activeChatIdAtom.set("missing"));

    expect(pageRoot()).toHaveAttribute("data-view", "list");
    expect(screen.getByText("Выберите чат или создайте новый")).toBeInTheDocument();
  });
});
