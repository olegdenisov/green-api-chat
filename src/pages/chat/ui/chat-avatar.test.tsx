import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "@test/render";

import { ChatAvatar } from "./chat-avatar";

function renderAvatar(chat: { chatId: string; title: string }) {
  render(
    <div data-testid="host">
      <ChatAvatar chat={chat} />
    </div>,
  );
  return screen.getByTestId("host");
}

describe("ChatAvatar", () => {
  it("shows the initials of a name", () => {
    renderAvatar({ chatId: "1", title: "Alice Bob" });

    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("shows a placeholder without a digit for a phone number title", () => {
    const host = renderAvatar({ chatId: "79991234567", title: "+79991234567" });

    expect(host).not.toHaveTextContent(/\d|\+/);
    expect(host.querySelector("svg")).not.toBeNull();
  });

  it("is hidden from assistive technology", () => {
    const host = renderAvatar({ chatId: "1", title: "Alice" });

    expect(host.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
