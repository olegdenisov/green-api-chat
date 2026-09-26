import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "@test/render";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("shows the caption with a decorative icon", () => {
    const { container } = render(<EmptyState>Пока пусто</EmptyState>);

    expect(screen.getByText("Пока пусто")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
