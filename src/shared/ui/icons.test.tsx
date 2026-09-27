import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  IconAlert,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconCheck,
  IconChecks,
  IconClock,
  IconLogo,
  IconLogout,
  IconMessageCircle,
  IconPlus,
  IconRotateCcw,
  IconSearch,
  IconSend,
  IconTrash,
  IconWifi,
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
    ["IconSearch", IconSearch],
    ["IconMessageCircle", IconMessageCircle],
    ["IconArrowUp", IconArrowUp],
    ["IconArrowRight", IconArrowRight],
    ["IconRotateCcw", IconRotateCcw],
    ["IconWifi", IconWifi],
  ])("%s is decorative, sized by the prop, and stroked at 1.8", (_name, Component) => {
    const { container } = render(<Component size={32} />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
    expect(svg).toHaveAttribute("stroke-width", "1.8");
  });

  it("defaults the size to 20", () => {
    const { container } = render(<IconSend />);

    expect(container.querySelector("svg")).toHaveAttribute("width", "20");
  });
});
