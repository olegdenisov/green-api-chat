import { rem } from "@mantine/core";
import { cleanup, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "@test/render";

import { ChatAvatar } from "./chat-avatar";

function renderAvatar(chat: { chatId: string; title: string }, radius?: number) {
  render(
    <div data-testid="host">
      <ChatAvatar chat={chat} radius={radius} />
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

    expect(first).toMatch(/--avatar-bg:\s*var\(--ga-avatar-\d-bg\)/);
    expect(color("79991234567")).toBe(first);
  });

  it("spreads chats over several of the five colour tokens", () => {
    const indices = ["1", "2", "3", "4", "5", "79991234567", "79997654321", "100500"].map(
      (chatId) => {
        cleanup();
        const style = renderAvatar({ chatId, title: "" }).firstElementChild?.getAttribute("style");
        return Number(style?.match(/--avatar-bg:\s*var\(--ga-avatar-(\d+)-bg\)/)?.[1]);
      },
    );

    for (const index of indices) {
      expect(index).toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(5);
    }
    expect(new Set(indices).size).toBeGreaterThanOrEqual(2);
  });

  it("uses the same colour token for the placeholder and the initials avatar of one chat", () => {
    cleanup();
    const placeholder = renderAvatar({
      chatId: "79991234567",
      title: "",
    }).firstElementChild?.getAttribute("style");
    cleanup();
    const initials = renderAvatar({
      chatId: "79991234567",
      title: "Alice Bob",
    }).firstElementChild?.getAttribute("style");

    expect(initials).toBe(placeholder);
  });

  it("is hidden from assistive technology", () => {
    const host = renderAvatar({ chatId: "1", title: "Alice" });

    expect(host.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("defaults to a rounded-square radius", () => {
    const host = renderAvatar({ chatId: "1", title: "Alice" });

    expect(host.firstElementChild).toHaveStyle({
      "--avatar-radius": rem(16),
    });
  });

  it("passes a custom radius through to --avatar-radius", () => {
    const host = renderAvatar({ chatId: "1", title: "Alice" }, 14);

    expect(host.firstElementChild).toHaveStyle({
      "--avatar-radius": rem(14),
    });
  });
});
