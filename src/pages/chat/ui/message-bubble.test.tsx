import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { messagesAtom, SEND_TIMEOUT, type Message } from "@/entities/message";
import { credentialsAtom } from "@/entities/session";

import { sendMessageResponse } from "@test/fixtures/green-api/send-message";
import { creds, respondByMethod, stubFetch } from "@test/green-api";
import { render } from "@test/render";

import { MessageBubble } from "./message-bubble";

const now = Date.now();
const outgoing: Message = {
  id: "local-1",
  chatId: "1",
  text: "Hello",
  direction: "out",
  status: "sent",
  timestamp: now,
  attemptAt: now,
};

const row = () => screen.getByText("Hello").closest("[data-direction]");

beforeEach(stubFetch);

describe("MessageBubble", () => {
  it("shows an outgoing sent message on the right with time and a check mark", () => {
    const timestamp = new Date(2026, 8, 25, 9, 5).getTime();
    render(<MessageBubble message={{ ...outgoing, timestamp, attemptAt: timestamp }} />);

    expect(row()).toHaveAttribute("data-direction", "out");
    expect(screen.getByText("09:05")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Отправлено" })).toHaveAttribute("data-status", "sent");
  });

  it("shows a delivered message with a double check mark", () => {
    render(<MessageBubble message={{ ...outgoing, status: "delivered" }} />);

    expect(screen.getByRole("img", { name: "Доставлено" })).toHaveAttribute(
      "data-status",
      "delivered",
    );
  });

  it("shows a read message with a peach double check mark", () => {
    render(<MessageBubble message={{ ...outgoing, status: "read" }} />);

    expect(screen.getByRole("img", { name: "Прочитано" })).toHaveAttribute("data-status", "read");
  });

  it("shows an incoming message on the left without a status", () => {
    render(<MessageBubble message={{ ...outgoing, direction: "in", attemptAt: undefined }} />);

    expect(row()).toHaveAttribute("data-direction", "in");
    expect(screen.queryByRole("img", { name: "Отправлено" })).not.toBeInTheDocument();
  });

  it("shows a sending message with a clock", () => {
    render(<MessageBubble message={{ ...outgoing, status: "sending" }} />);

    expect(screen.getByRole("img", { name: "Отправляется" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
  });

  it("shows a stale sending message as not sent", () => {
    const attemptAt = now - SEND_TIMEOUT - 1;
    render(<MessageBubble message={{ ...outgoing, status: "sending", attemptAt }} />);

    expect(screen.getByText("Не отправлено")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });

  it("turns a sending message into not sent once SEND_TIMEOUT passes", async () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const attemptAt = Date.now();
    render(<MessageBubble message={{ ...outgoing, status: "sending", attemptAt }} />);
    expect(screen.getByRole("img", { name: "Отправляется" })).toBeInTheDocument();

    // `act`: the timer's re-render is a state update outside React events.
    await act(() => vi.advanceTimersByTimeAsync(SEND_TIMEOUT - 1));
    expect(screen.getByRole("img", { name: "Отправляется" })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(2));
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    expect(row()?.querySelector("[data-failed]")).not.toBeNull();
  });

  it("retries a failed message until it is sent", async () => {
    respondByMethod({ sendMessage: { body: sendMessageResponse } });
    const user = userEvent.setup();
    const failed: Message = { ...outgoing, status: "failed" };
    const { frame } = render(<MessageBubble message={failed} />);
    frame.run(() => {
      credentialsAtom.set(creds);
      messagesAtom.set({ "1": [failed] });
    });

    expect(screen.getByText("Не отправлено")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Повторить" }));

    await waitFor(() =>
      expect(frame.run(() => messagesAtom()["1"])).toEqual([
        {
          ...failed,
          id: sendMessageResponse.idMessage,
          status: "sent",
          attemptAt: expect.any(Number),
        },
      ]),
    );
  });
});
