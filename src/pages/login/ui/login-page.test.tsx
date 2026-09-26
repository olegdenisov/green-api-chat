import { render } from "@test/render";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginPage } from "./login-page";

describe("LoginPage", () => {
  it("renders the title and the login form", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { level: 1, name: "GREEN-API chat" })).toBeInTheDocument();
    expect(screen.getByLabelText("idInstance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Войти" })).toBeInTheDocument();
  });

  it("links to the GREEN-API console in a new tab", () => {
    render(<LoginPage />);

    const link = screen.getByRole("link", { name: "консоли GREEN-API" });
    expect(link).toHaveAttribute("href", "https://console.green-api.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });
});
