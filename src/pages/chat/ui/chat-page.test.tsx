import { render } from "@test/render";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { chatsAtom } from "@/entities/chat";

import { ChatPage } from "./chat-page";

describe("ChatPage", () => {
  it("renders the stub and the logout button", () => {
    render(<ChatPage />);

    expect(screen.getByText("Чаты появятся здесь")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
  });

  it("lists chat titles, newest first", async () => {
    const { frame } = render(<ChatPage />);
    frame.run(() =>
      chatsAtom.set({
        "1": { chatId: "1", title: "Old", lastMessageAt: 1 },
        "2": { chatId: "2", title: "New", lastMessageAt: 2 },
      }),
    );

    expect((await screen.findAllByRole("listitem")).map((item) => item.textContent)).toEqual([
      "New",
      "Old",
    ]);
    expect(screen.queryByText("Чаты появятся здесь")).not.toBeInTheDocument();
  });
});
