import { render } from "@test/render";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppTitle } from "./app-title";

describe("AppTitle", () => {
  it("renders the app name as the h1", () => {
    render(<AppTitle />);

    expect(screen.getByRole("heading", { level: 1, name: "GREEN-API chat" })).toBeInTheDocument();
  });

  it("appends a custom className to its own", () => {
    render(<AppTitle className="custom" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveClass("custom");
    expect(heading.classList.length).toBeGreaterThan(2);
  });
});
