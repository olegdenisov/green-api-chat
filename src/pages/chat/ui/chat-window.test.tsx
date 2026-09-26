import { notifications } from "@mantine/notifications";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { activeChatIdAtom, chatsAtom, openChat, type Chat } from "@/entities/chat";
import { addMessage, messagesAtom, type Message } from "@/entities/message";
import { credentialsAtom } from "@/entities/session";

import { sendMessageResponse } from "@test/fixtures/green-api/send-message";
import { creds, respondByMethod, stubFetch } from "@test/green-api";
import { render } from "@test/render";

import { ChatWindow } from "./chat-window";

const friend: Chat = { chatId: "1", title: "Friend", lastMessageAt: 1 };

const message = (
  id: string,
  text: string,
  direction: Message["direction"],
  timestamp = Date.now(),
): Message => ({
  id,
  chatId: friend.chatId,
  text,
  direction,
  status: "sent",
  timestamp,
});

function renderWindow() {
  const result = render(<ChatWindow />);
  result.frame.run(() => {
    credentialsAtom.set(creds);
    openChat(friend);
  });
  return result;
}

const feed = () => screen.getByRole("log", { name: "Сообщения" });

beforeEach(stubFetch);
afterEach(() => notifications.clean());

describe("ChatWindow", () => {
  it("shows the stub without an active chat", () => {
    render(<ChatWindow />);

    expect(screen.getByText("Выберите чат или создайте новый")).toBeInTheDocument();
    expect(screen.queryByLabelText("Сообщение")).not.toBeInTheDocument();
  });

  it("shows the header, the empty feed and the input", async () => {
    renderWindow();

    expect(await screen.findByRole("heading", { level: 2 })).toHaveTextContent("Friend");
    expect(within(feed()).getByText("Сообщений пока нет")).toBeInTheDocument();
    expect(screen.getByLabelText("Сообщение")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Удалить чат" })).toBeInTheDocument();
  });

  it("shows the messages in order", async () => {
    const { frame } = renderWindow();
    frame.run(() => {
      addMessage(message("a", "Hi there", "in"));
      addMessage(message("b", "Hello", "out"));
    });

    await waitFor(() => expect(within(feed()).getByText("Hello")).toBeInTheDocument());
    const rows = feed().querySelectorAll("[data-direction]");
    expect([...rows].map((row) => row.getAttribute("data-direction"))).toEqual(["in", "out"]);
    expect(within(feed()).queryByText("Сообщений пока нет")).not.toBeInTheDocument();
  });

  it("puts one day separator before the first message of each day, in order", async () => {
    vi.setSystemTime(new Date(2026, 8, 25, 15, 0, 0));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const today = new Date(2026, 8, 25, 12).getTime();
    const yesterday = new Date(2026, 8, 24, 12).getTime();
    const longAgo = new Date(2020, 0, 3, 9).getTime();
    const { frame } = renderWindow();
    frame.run(() => {
      addMessage(message("a", "Old", "in", longAgo));
      addMessage(message("b", "Yesterday 1", "in", yesterday));
      addMessage(message("c", "Yesterday 2", "out", yesterday + 60_000));
      addMessage(message("d", "Today", "in", today));
    });

    await waitFor(() => expect(within(feed()).getByText("Today")).toBeInTheDocument());
    const separators = within(feed()).getAllByRole("separator");
    expect(separators.map((separator) => separator.getAttribute("aria-label"))).toEqual([
      "3 января 2020",
      "Вчера",
      "Сегодня",
    ]);
    // A separator precedes the first message of its day, not the following ones. Identify each
    // child by role/data-* rather than by its rendered text (which also carries the time).
    const order = [...feed().children].map((child) =>
      child.getAttribute("role") === "separator"
        ? `sep:${child.getAttribute("aria-label")}`
        : (child as HTMLElement).dataset.messageId,
    );
    expect(order).toEqual(["sep:3 января 2020", "a", "sep:Вчера", "b", "c", "sep:Сегодня", "d"]);
  });

  it("puts separate separators across a local-midnight boundary", async () => {
    vi.setSystemTime(new Date(2026, 8, 25, 15, 0, 0));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const beforeMidnight = new Date(2026, 8, 24, 23, 59).getTime();
    const afterMidnight = new Date(2026, 8, 25, 0, 1).getTime();
    const { frame } = renderWindow();
    frame.run(() => {
      addMessage(message("a", "Late", "in", beforeMidnight));
      addMessage(message("b", "Early", "in", afterMidnight));
    });

    await waitFor(() => expect(within(feed()).getByText("Early")).toBeInTheDocument());
    const separators = within(feed()).getAllByRole("separator");
    expect(separators.map((separator) => separator.getAttribute("aria-label"))).toEqual([
      "Вчера",
      "Сегодня",
    ]);
  });

  it("shows no separator in an empty feed", async () => {
    renderWindow();

    await screen.findByText("Сообщений пока нет");
    expect(within(feed()).queryByRole("separator")).not.toBeInTheDocument();
  });

  it("scrolls the feed down when a message is added", async () => {
    const { frame } = renderWindow();
    const element = await screen.findByRole("log", { name: "Сообщения" });
    Object.defineProperty(element, "scrollHeight", { configurable: true, value: 500 });

    frame.run(() => addMessage(message("a", "Hi there", "in")));

    await waitFor(() => expect(element.scrollTop).toBe(500));
  });

  it("opens another chat at its latest message, even with the same message count", async () => {
    // jsdom has no layout: every element reports this height.
    const scrollHeight = Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight")!;
    Object.defineProperty(Element.prototype, "scrollHeight", { configurable: true, value: 800 });
    onTestFinished(() => {
      Object.defineProperty(Element.prototype, "scrollHeight", scrollHeight);
    });
    const colleague: Chat = { chatId: "2", title: "Colleague", lastMessageAt: 2 };
    const { frame } = renderWindow();
    frame.run(() => {
      openChat(colleague);
      addMessage({ ...message("b", "From colleague", "in"), chatId: colleague.chatId });
      activeChatIdAtom.set(friend.chatId);
      addMessage(message("a", "From friend", "in"));
    });
    await waitFor(() => expect(within(feed()).getByText("From friend")).toBeInTheDocument());
    await waitFor(() => expect(feed().scrollTop).toBe(800));
    // The user scrolls up in this chat, then opens another one.
    feed().scrollTop = 0;

    frame.run(() => activeChatIdAtom.set(colleague.chatId));

    await waitFor(() => expect(within(feed()).getByText("From colleague")).toBeInTheDocument());
    expect(feed().scrollTop).toBe(800);
  });

  it("sends a message: it shows up, fails and is sent on retry", async () => {
    respondByMethod({ sendMessage: { body: {}, status: 500 } });
    const user = userEvent.setup();
    renderWindow();

    await user.type(await screen.findByLabelText("Сообщение"), "Hello{Enter}");
    expect(within(feed()).getByText("Hello")).toBeInTheDocument();
    const retry = await screen.findByRole("button", { name: "Повторить" });

    respondByMethod({ sendMessage: { body: sendMessageResponse } });
    await user.click(retry);

    expect(await screen.findByLabelText("Отправлено")).toBeInTheDocument();
    expect(screen.queryByText(/Не отправлено/)).not.toBeInTheDocument();
  });

  it("returns to the list on back", async () => {
    const user = userEvent.setup();
    const { frame } = renderWindow();

    await user.click(await screen.findByRole("button", { name: "Назад к чатам" }));

    expect(frame.run(() => activeChatIdAtom())).toBeNull();
    expect(screen.getByText("Выберите чат или создайте новый")).toBeInTheDocument();
  });

  it("deletes the chat and shows the stub", async () => {
    const user = userEvent.setup();
    const { frame } = renderWindow();
    frame.run(() => addMessage(message("a", "Hi there", "in")));

    await user.click(await screen.findByRole("button", { name: "Удалить чат" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    expect(await screen.findByText("Выберите чат или создайте новый")).toBeInTheDocument();
    expect(frame.run(() => chatsAtom())).toEqual({});
    expect(frame.run(() => messagesAtom())).toEqual({});
  });
});
