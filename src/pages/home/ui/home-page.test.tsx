import { render } from "@test/render";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePage } from "./home-page";
import classes from "./home-page.module.css";

describe("HomePage", () => {
  it("renders the stub title styled by the CSS Module", () => {
    render(<HomePage />);

    const title = screen.getByRole("heading", { level: 1, name: "GREEN-API chat" });
    expect(title).toHaveClass(classes.title);
  });
});
