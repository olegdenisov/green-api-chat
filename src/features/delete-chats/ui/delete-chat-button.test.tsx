import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { activeChatIdAtom, type Chat, chatsAtom, openChat } from "@/entities/chat";
import { addMessage, messagesAtom } from "@/entities/message";

import { render } from "@test/render";

import { DeleteChatButton } from "./delete-chat-button";

const alice: Chat = { chatId: "1001", title: "alice", lastMessageAt: 100 };

function renderButton() {
  const result = render(<DeleteChatButton chatId={alice.chatId} />);
  result.frame.run(() => {
    openChat(alice);
    addMessage({
      id: "local-1",
      chatId: alice.chatId,
      text: "Hello",
      direction: "out",
      status: "sent",
      timestamp: 100,
      attemptAt: 100,
    });
  });
  return result;
}

describe("DeleteChatButton", () => {
  it("asks for confirmation and keeps the chat on cancel", async () => {
    const user = userEvent.setup();
    const { frame } = renderButton();

    await user.click(screen.getByRole("button", { name: "Удалить чат" }));
    expect(screen.getByText("Удалить чат и историю?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    await waitFor(() => expect(screen.queryByText("Удалить чат и историю?")).toBeNull());
    expect(frame.run(() => chatsAtom())).toEqual({ [alice.chatId]: alice });
    expect(frame.run(() => messagesAtom()[alice.chatId])).toHaveLength(1);
  });

  it("deletes the chat and its history on confirm", async () => {
    const user = userEvent.setup();
    const { frame } = renderButton();

    await user.click(screen.getByRole("button", { name: "Удалить чат" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    expect(frame.run(() => chatsAtom())).toEqual({});
    expect(frame.run(() => messagesAtom())).toEqual({});
    expect(frame.run(() => activeChatIdAtom())).toBeNull();
    await waitFor(() => expect(screen.queryByText("Удалить чат и историю?")).toBeNull());
  });
});
