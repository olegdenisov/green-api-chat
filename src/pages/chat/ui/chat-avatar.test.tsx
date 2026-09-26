import { cleanup, screen } from "@testing-library/react";
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

  it("takes initials without the @ of a username", () => {
    const host = renderAvatar({ chatId: "1", title: "@username" });

    expect(host).toHaveTextContent("US");
    expect(host).not.toHaveTextContent("@");
  });

  it("takes two initials from a name with repeated spaces", () => {
    const host = renderAvatar({ chatId: "1", title: "Alice  Bob" });

    expect(host).toHaveTextContent("AB");
  });

  it.each([
    ["a title starting with a digit", "3D Team"],
    ["an empty title", ""],
    ["a lone @", "@"],
  ])("shows a placeholder for %s", (_label, title) => {
    const host = renderAvatar({ chatId: "1", title });

    expect(host).toHaveTextContent("");
    expect(host.querySelector("svg")).not.toBeNull();
  });

  it("picks the placeholder colour by chatId: stable per chat", () => {
    const color = (chatId: string) => {
      cleanup();
      const host = renderAvatar({ chatId, title: "" });
      return host.firstElementChild?.getAttribute("style");
    };
    const first = color("79991234567");

    expect(first).toContain("--avatar-bg");
    expect(color("79991234567")).toBe(first);
  });

  it("is hidden from assistive technology", () => {
    const host = renderAvatar({ chatId: "1", title: "Alice" });

    expect(host.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
