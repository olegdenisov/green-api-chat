import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  IconAlert,
  IconArrowLeft,
  IconCheck,
  IconChecks,
  IconClock,
  IconLogo,
  IconLogout,
  IconPlus,
  IconSend,
  IconTrash,
} from "./icons";

describe("icons", () => {
  it.each([
    ["IconArrowLeft", IconArrowLeft],
    ["IconSend", IconSend],
    ["IconTrash", IconTrash],
    ["IconLogout", IconLogout],
    ["IconPlus", IconPlus],
    ["IconLogo", IconLogo],
    ["IconClock", IconClock],
    ["IconCheck", IconCheck],
    ["IconChecks", IconChecks],
    ["IconAlert", IconAlert],
  ])("%s is decorative and sized by the prop", (_name, Component) => {
    const { container } = render(<Component size={32} />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
  });

  it("defaults the size to 20", () => {
    const { container } = render(<IconSend />);

    expect(container.querySelector("svg")).toHaveAttribute("width", "20");
  });
});
