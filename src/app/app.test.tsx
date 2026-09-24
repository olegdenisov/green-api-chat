// App brings its own providers, so it is rendered with plain Testing Library
// render (not @test/render) to avoid nested providers. Page behaviour is tested
// in the page's own tests via @test/render.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./app";

describe("App", () => {
  it("mounts the home page inside the app providers", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "GREEN-API chat" })).toBeInTheDocument();
  });
});
