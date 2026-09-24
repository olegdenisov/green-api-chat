import { action, atom, wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { render } from "@test/render";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

const counter = atom(0, "test.counter");
const increment = action(() => counter.set((value) => value + 1), "test.increment");

const Counter = reatomComponent(
  () => (
    <button type="button" onClick={wrap(() => increment())}>
      count: {counter()}
    </button>
  ),
  "Counter",
);

describe("Reatom context in tests", () => {
  it("re-renders a reatomComponent after an action changes the atom", async () => {
    const user = userEvent.setup();
    const { frame } = render(<Counter />);

    await user.click(screen.getByRole("button", { name: "count: 0" }));
    await user.click(screen.getByRole("button", { name: "count: 1" }));

    expect(screen.getByRole("button")).toHaveTextContent("count: 2");
    expect(frame.run(() => counter())).toBe(2);
  });

  it("starts every render with a fresh context", () => {
    const { frame } = render(<Counter />);

    expect(screen.getByRole("button")).toHaveTextContent("count: 0");
    expect(frame.run(() => counter())).toBe(0);
  });
});
