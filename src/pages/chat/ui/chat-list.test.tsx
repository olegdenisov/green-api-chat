import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { activeChatIdAtom, chatsAtom } from "@/entities/chat";
import { messagesAtom } from "@/entities/message";

import { render } from "@test/render";

import { ChatList } from "./chat-list";

describe("ChatList", () => {
  it("shows the empty state without chats", () => {
    render(<ChatList />);

    expect(screen.getByText("Создайте чат по номеру телефона")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("lists chats newest first with the last message and time", async () => {
    // Midday: "a minute ago" and "a day ago" stay on their own days.
    vi.useFakeTimers({ toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    vi.setSystemTime(new Date(2026, 8, 25, 12, 34));
    const now = Date.now();
    const { frame } = render(<ChatList />);
    frame.run(() => {
      chatsAtom.set({
        "1": { chatId: "1", title: "Old", lastMessageAt: now - 24 * 60 * 60_000 },
        "2": { chatId: "2", title: "New", lastMessageAt: now },
      });
      messagesAtom.set({
        "2": [
          { id: "a", chatId: "2", text: "first", direction: "out", status: "sent", timestamp: 1 },
          { id: "b", chatId: "2", text: "last", direction: "in", status: "sent", timestamp: 2 },
        ],
      });
    });

    const rows = await screen.findAllByRole("button");
    expect(rows.map((row) => within(row).getByText(/^(Old|New)$/).textContent)).toEqual([
      "New",
      "Old",
    ]);
    expect(within(rows[0]!).getByText("last")).toBeInTheDocument();
    expect(within(rows[0]!).queryByText("first")).not.toBeInTheDocument();
    expect(within(rows[0]!).getByText("12:34")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("24.09.26")).toBeInTheDocument();
  });

  it("highlights the active chat and selects a chat on click", async () => {
    const user = userEvent.setup();
    const { frame } = render(<ChatList />);
    frame.run(() => {
      chatsAtom.set({
        "1": { chatId: "1", title: "Alice", lastMessageAt: 2 },
        "2": { chatId: "2", title: "Bob", lastMessageAt: 1 },
      });
      activeChatIdAtom.set("1");
    });

    const alice = await screen.findByRole("button", { name: /Alice/ });
    const bob = screen.getByRole("button", { name: /Bob/ });
    expect(alice).toHaveAttribute("aria-current", "true");
    expect(alice).toHaveAttribute("data-active");
    expect(bob).not.toHaveAttribute("aria-current");

    await user.click(bob);

    expect(frame.run(() => activeChatIdAtom())).toBe("2");
    expect(bob).toHaveAttribute("aria-current", "true");
    expect(alice).not.toHaveAttribute("aria-current");
  });
});
