import { render } from "@test/render";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePage } from "./home-page";

describe("HomePage", () => {
  it("renders the stub title with Mantine and the CSS Module class", () => {
    render(<HomePage />);

    const title = screen.getByRole("heading", { level: 1, name: "GREEN-API chat" });
    expect(title).toHaveClass("mantine-Title-root");
    expect(title.className).toMatch(/_title_/);
  });
});
