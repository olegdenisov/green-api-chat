import { notifications } from "@mantine/notifications";
import { context } from "@reatom/core";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { activeChatIdAtom, chatsAtom, openChat } from "@/entities/chat";
import { addMessage, messagesAtom } from "@/entities/message";
import { credentialsAtom } from "@/entities/session";

import { deleteNotificationResponse } from "@test/fixtures/green-api/delete-notification";
import { getSettingsResponse } from "@test/fixtures/green-api/get-settings";
import { getStateInstanceResponse } from "@test/fixtures/green-api/get-state-instance";
import { incomingTextMessage } from "@test/fixtures/green-api/incoming-text-message";
import { outgoingApiMessage } from "@test/fixtures/green-api/outgoing-api-message";
import { outgoingMessage } from "@test/fixtures/green-api/outgoing-message";
import { sendMessageResponse } from "@test/fixtures/green-api/send-message";
import {
  calledMethods,
  creds,
  deferFetch,
  fetchMock,
  hangUntilAbort,
  respondByMethod,
  stubFetch,
} from "@test/green-api";

import { App } from "./app";

const chatStub = () => screen.queryByText("Выберите чат или создайте новый");
const idInput = () => screen.getByLabelText("idInstance");

beforeEach(stubFetch);
afterEach(() => notifications.clean());

// App owns its providers (its own Reatom frame), so it uses plain RTL render.
describe("App", () => {
  it("shows the login form without credentials", () => {
    render(<App />);

    expect(idInput()).toBeInTheDocument();
    expect(chatStub()).not.toBeInTheDocument();
  });

  it("shows the chat when credentials were saved before", () => {
    // Another frame persists the credentials to localStorage, as a previous page load would.
    context.start(() => credentialsAtom.set(creds));

    render(<App />);

    expect(chatStub()).toBeInTheDocument();
    expect(screen.queryByLabelText("idInstance")).not.toBeInTheDocument();
    // ReceiveMessages renders nothing; no connection strip while polling is not failing.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("opens the chat after login and returns to an empty form after logout", async () => {
    respondByMethod({
      getStateInstance: { body: getStateInstanceResponse },
      getSettings: { body: getSettingsResponse },
      receiveNotification: "hang",
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(idInput(), creds.idInstance);
    await user.type(screen.getByLabelText("apiTokenInstance"), creds.apiTokenInstance);
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByText("Выберите чат или создайте новый")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Выйти" }));

    expect(idInput()).toHaveValue("");
    expect(screen.getByLabelText("apiTokenInstance")).toHaveValue("");
    expect(screen.getByLabelText("apiUrl")).toHaveValue("");
    expect(chatStub()).not.toBeInTheDocument();
    // A reload (a fresh frame reading localStorage) stays logged out.
    context.start(() => expect(credentialsAtom()).toBeNull());
  });

  it("logout wipes the chats, the messages and the new-chat form", async () => {
    respondByMethod({
      getStateInstance: { body: getStateInstanceResponse },
      getSettings: { body: getSettingsResponse },
      receiveNotification: "hang",
    });
    // A previous session left a chat with a message.
    context.start(() => {
      credentialsAtom.set(creds);
      openChat({ chatId: "10000000", title: "Friend", lastMessageAt: 1 });
      addMessage({
        id: "local-1",
        chatId: "10000000",
        text: "Hello",
        direction: "out",
        status: "sent",
        timestamp: 1,
        attemptAt: 1,
      });
    });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Friend" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Номер телефона"), "79991234567");
    await user.click(screen.getByRole("button", { name: "Выйти" }));

    await user.type(idInput(), creds.idInstance);
    await user.type(screen.getByLabelText("apiTokenInstance"), creds.apiTokenInstance);
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByText("Выберите чат или создайте новый")).toBeInTheDocument();
    expect(screen.getByLabelText("Номер телефона")).toHaveValue("");
    expect(screen.queryByText("Friend")).not.toBeInTheDocument();
    context.start(() => {
      expect(chatsAtom()).toEqual({});
      expect(messagesAtom()).toEqual({});
      expect(activeChatIdAtom()).toBeNull();
    });
  });

  describe("receiving", () => {
    const chatList = () => screen.getByRole("list");

    it("starts polling after login and lists an incoming chat without selecting it", async () => {
      respondByMethod({
        getStateInstance: { body: getStateInstanceResponse },
        getSettings: { body: getSettingsResponse },
        receiveNotification: [{ body: { receiptId: 1, body: incomingTextMessage } }, "hang"],
        deleteNotification: { body: deleteNotificationResponse },
      });
      const user = userEvent.setup();
      render(<App />);

      await user.type(idInput(), creds.idInstance);
      await user.type(screen.getByLabelText("apiTokenInstance"), creds.apiTokenInstance);
      await user.click(screen.getByRole("button", { name: "Войти" }));

      const row = await screen.findByRole("button", { name: /Василиса Премудрая/ });
      expect(
        within(row).getByText(incomingTextMessage.messageData.textMessageData.textMessage),
      ).toBeInTheDocument();
      expect(row).not.toHaveAttribute("aria-current");
      expect(chatStub()).toBeInTheDocument();
      await waitFor(() =>
        expect(calledMethods().filter((method) => method === "receiveNotification")).toHaveLength(
          2,
        ),
      );
      expect(calledMethods()).toContain("deleteNotification");
    });

    it("keeps one sent message when the API event outruns the sendMessage answer", async () => {
      const chatId = outgoingApiMessage.senderData.chatId;
      context.start(() => {
        credentialsAtom.set(creds);
        openChat({ chatId, title: "Василиса", lastMessageAt: 1 });
      });
      const fetches = deferFetch();
      const user = userEvent.setup();
      render(<App />);
      const feed = () => screen.getByRole("log", { name: "Сообщения" });

      // The long poll is pending; the message goes out next.
      await waitFor(() => expect(calledMethods()).toEqual(["receiveNotification"]));
      await user.type(screen.getByLabelText("Сообщение"), "Hello{Enter}");
      await waitFor(() => expect(calledMethods()).toEqual(["receiveNotification", "sendMessage"]));

      // The queue delivers the API event before the sendMessage answer.
      fetches.resolveAt(0, {
        receiptId: 1,
        body: {
          ...outgoingApiMessage,
          idMessage: sendMessageResponse.idMessage,
          messageData: { typeMessage: "textMessage", textMessageData: { textMessage: "Hello" } },
        },
      });
      await waitFor(() => expect(calledMethods()).toContain("deleteNotification"));
      fetches.resolveAt(1, deleteNotificationResponse);
      // The event matched the pending send: one message, already sent.
      expect(await within(feed()).findByLabelText("Отправлено")).toBeInTheDocument();
      expect(within(feed()).getAllByText("Hello")).toHaveLength(1);

      // The late answer changes nothing.
      fetches.resolveAt(0, sendMessageResponse);
      await waitFor(() => expect(fetches.pending()).toBe(1)); // The next long poll.
      expect(within(feed()).getAllByText("Hello")).toHaveLength(1);
      expect(within(feed()).getAllByLabelText("Отправлено")).toHaveLength(1);
      expect(within(chatList()).getAllByRole("button")).toHaveLength(1);
    });

    it("shows a message sent from the phone in the open chat as outgoing", async () => {
      const chatId = outgoingMessage.senderData.chatId;
      context.start(() => {
        credentialsAtom.set(creds);
        openChat({ chatId, title: "Василиса", lastMessageAt: 1 });
      });
      respondByMethod({
        receiveNotification: [{ body: { receiptId: 1, body: outgoingMessage } }, "hang"],
        deleteNotification: { body: deleteNotificationResponse },
      });
      render(<App />);
      const feed = () => screen.getByRole("log", { name: "Сообщения" });

      const text = outgoingMessage.messageData.textMessageData.textMessage;
      const bubble = await within(feed()).findByText(text);
      expect(bubble.closest("[data-direction]")).toHaveAttribute("data-direction", "out");
      expect(within(feed()).getByLabelText("Отправлено")).toBeInTheDocument();
      expect(within(chatList()).getAllByRole("button")).toHaveLength(1);
    });

    it("shows the connection strip after network errors and hides it on recovery", async () => {
      vi.useFakeTimers();
      try {
        context.start(() => credentialsAtom.set(creds));
        hangUntilAbort();
        fetchMock
          .mockRejectedValueOnce(new TypeError("Failed to fetch"))
          .mockRejectedValueOnce(new TypeError("Failed to fetch"))
          .mockResolvedValueOnce(new Response("null"));
        render(<App />);
        const strip = () => screen.queryByRole("status");

        // First failure: a pause of 1 s, no strip yet.
        await act(() => vi.advanceTimersByTimeAsync(0));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(strip()).toBeNull();

        // Second failure: the strip appears, the next try is in 2 s.
        await act(() => vi.advanceTimersByTimeAsync(1000));
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(strip()).toHaveTextContent("Соединение…");
        await act(() => vi.advanceTimersByTimeAsync(1999));
        expect(fetchMock).toHaveBeenCalledTimes(2);

        // An empty answer is a success: the strip hides, the next long poll is pending.
        await act(() => vi.advanceTimersByTimeAsync(1));
        expect(strip()).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(4);
      } finally {
        vi.useRealTimers();
      }
    });

    it("stops polling on logout", async () => {
      context.start(() => credentialsAtom.set(creds));
      respondByMethod({ receiveNotification: "hang" });
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => expect(calledMethods()).toEqual(["receiveNotification"]));
      await user.click(screen.getByRole("button", { name: "Выйти" }));

      expect(idInput()).toBeInTheDocument();
      await waitFor(() => expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(calledMethods()).toEqual(["receiveNotification"]);
    });

    it("logs out with a toast on 401 from polling", async () => {
      context.start(() => credentialsAtom.set(creds));
      respondByMethod({ receiveNotification: { body: {}, status: 401 } });
      render(<App />);

      expect(await screen.findByText("Сессия недействительна, войдите заново")).toBeInTheDocument();
      expect(idInput()).toHaveValue("");
      expect(chatStub()).not.toBeInTheDocument();
      expect(calledMethods()).toEqual(["receiveNotification"]);
      context.start(() => expect(credentialsAtom()).toBeNull());
    });
  });
});
