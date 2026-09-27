import { rem } from "@mantine/core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppLogo } from "./app-logo";

describe("AppLogo", () => {
  it("sizes the square and the icon from its props", () => {
    const { container } = render(<AppLogo size={56} radius={16} iconSize={28} className="extra" />);

    const logo = container.firstElementChild as HTMLElement;
    expect(logo).toHaveClass("extra");
    expect(logo.style.getPropertyValue("--app-logo-size")).toBe(rem(56));
    expect(logo.style.getPropertyValue("--app-logo-radius")).toBe(rem(16));
    const icon = logo.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("width", "28");
  });
});
