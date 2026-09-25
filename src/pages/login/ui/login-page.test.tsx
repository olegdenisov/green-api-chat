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
});
