import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "@test/render";

import { Sidebar } from "./sidebar";

describe("Sidebar", () => {
  it("shows the app title as the page heading", () => {
    render(<Sidebar />);

    expect(screen.getByRole("heading", { level: 1, name: "GREEN-API chat" })).toBeInTheDocument();
  });

  it("has the logout button, the new chat field and the chats navigation", () => {
    render(<Sidebar />);

    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Чаты" });
    expect(nav).toHaveTextContent("Создайте чат по номеру телефона");
  });

  it("appends the given class name", () => {
    render(<Sidebar className="extra" />);

    expect(screen.getByRole("complementary")).toHaveClass("extra");
  });
});
