import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./app";

// Smoke check: App owns its providers, so it uses plain RTL render.
describe("App", () => {
  it("mounts", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
