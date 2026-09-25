import { render } from "@test/render";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatPage } from "./chat-page";

describe("ChatPage", () => {
  it("renders the stub and the logout button", () => {
    render(<ChatPage />);

    expect(screen.getByText("Чаты появятся здесь")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
  });
});
