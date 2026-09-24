import { render } from "@test/render";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./app";

describe("App", () => {
  it("renders the stub title with Mantine", () => {
    render(<App />);

    const title = screen.getByRole("heading", { level: 1, name: "GREEN-API chat" });
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass("mantine-Title-root");
  });
});
