import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { messagesAtom, SEND_TIMEOUT, type Message } from "@/entities/message";
import { credentialsAtom } from "@/entities/session";

import { sendMessageResponse } from "@test/fixtures/green-api/send-message";
import { creds, respondByMethod, stubFetch } from "@test/green-api";
import { render } from "@test/render";

import { formatTime } from "../lib/format-time";
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
    render(<MessageBubble message={outgoing} />);

    expect(row()).toHaveAttribute("data-direction", "out");
    expect(screen.getByText(formatTime(now))).toBeInTheDocument();
    expect(screen.getByLabelText("Отправлено")).toHaveTextContent("✓");
  });

  it("shows an incoming message on the left without a status", () => {
    render(<MessageBubble message={{ ...outgoing, direction: "in", attemptAt: undefined }} />);

    expect(row()).toHaveAttribute("data-direction", "in");
    expect(screen.queryByLabelText("Отправлено")).not.toBeInTheDocument();
  });

  it("shows a sending message with an ellipsis", () => {
    render(<MessageBubble message={{ ...outgoing, status: "sending" }} />);

    expect(screen.getByLabelText("Отправляется")).toHaveTextContent("…");
    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
  });

  it("shows a stale sending message as not sent", () => {
    const attemptAt = now - SEND_TIMEOUT - 1;
    render(<MessageBubble message={{ ...outgoing, status: "sending", attemptAt }} />);

    expect(screen.getByText(/Не отправлено/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
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

    expect(screen.getByText(/Не отправлено/)).toBeInTheDocument();
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
