import { notifications } from "@mantine/notifications";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { activeChatIdAtom, chatsAtom, openChat, type Chat } from "@/entities/chat";
import { addMessage, messagesAtom, type Message } from "@/entities/message";
import { credentialsAtom } from "@/entities/session";

import { sendMessageResponse } from "@test/fixtures/green-api/send-message";
import { creds, respondByMethod, stubFetch } from "@test/green-api";
import { render } from "@test/render";

import { ChatWindow } from "./chat-window";

const friend: Chat = { chatId: "1", title: "Friend", lastMessageAt: 1 };

const message = (id: string, text: string, direction: Message["direction"]): Message => ({
  id,
  chatId: friend.chatId,
  text,
  direction,
  status: "sent",
  timestamp: Date.now(),
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

  it("scrolls the feed down when a message is added", async () => {
    const { frame } = renderWindow();
    const element = await screen.findByRole("log", { name: "Сообщения" });
    Object.defineProperty(element, "scrollHeight", { configurable: true, value: 500 });

    frame.run(() => addMessage(message("a", "Hi there", "in")));

    await waitFor(() => expect(element.scrollTop).toBe(500));
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
