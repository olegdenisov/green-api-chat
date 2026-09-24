import { atom, wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ReatomProvider } from "./reatom-provider";

const counter = atom(0, "test.providerCounter");

const Counter = reatomComponent(
  () => (
    <button type="button" onClick={wrap(() => counter.set((value) => value + 1))}>
      count: {counter()}
    </button>
  ),
  "Counter",
);

// Real provider with plain RTL render (not @test/render, which has its own frame).
describe("ReatomProvider", () => {
  it("gives reatomComponents a working context", async () => {
    const user = userEvent.setup();
    render(
      <ReatomProvider>
        <Counter />
      </ReatomProvider>,
    );

    await user.click(screen.getByRole("button", { name: "count: 0" }));

    expect(screen.getByRole("button")).toHaveTextContent("count: 1");
  });

  it("creates a separate context for every provider instance", async () => {
    const user = userEvent.setup();
    const first = render(
      <ReatomProvider>
        <Counter />
      </ReatomProvider>,
    );
    await user.click(screen.getByRole("button", { name: "count: 0" }));
    first.unmount();

    render(
      <ReatomProvider>
        <Counter />
      </ReatomProvider>,
    );

    expect(screen.getByRole("button")).toHaveTextContent("count: 0");
  });
});
