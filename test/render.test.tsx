import { action, atom, context, wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { render, teardownRender } from "@test/render";
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

describe("render from @test/render", () => {
  it("re-renders a reatomComponent after an action changes the atom", async () => {
    const user = userEvent.setup();
    const { frame } = render(<Counter />);

    await user.click(screen.getByRole("button", { name: "count: 0" }));
    await user.click(screen.getByRole("button", { name: "count: 1" }));

    expect(screen.getByRole("button")).toHaveTextContent("count: 2");
    expect(frame.run(() => counter())).toBe(2);
  });

  it("starts every render with a fresh context", async () => {
    const first = render(<Counter />);
    first.frame.run(() => counter.set(5));
    expect(await screen.findByRole("button", { name: "count: 5" })).toBeInTheDocument();
    first.unmount();

    const second = render(<Counter />);

    expect(second.frame).not.toBe(first.frame);
    expect(screen.getByRole("button")).toHaveTextContent("count: 0");
    expect(second.frame.run(() => counter())).toBe(0);
  });

  it("aborts wrap()-ed callbacks of the frame on teardown", () => {
    const { frame } = render(<Counter />);
    const later = frame.run(() => wrap(() => counter.set(1)));

    teardownRender();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(later).toThrow("context reset");
  });

  it("has no default global context, like production after clearStack()", () => {
    expect(() => counter()).toThrow("missing async stack");
    expect(context.start(() => counter())).toBe(0);
  });
});
