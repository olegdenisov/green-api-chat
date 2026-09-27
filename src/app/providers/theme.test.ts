import { DEFAULT_THEME, mergeMantineTheme } from "@mantine/core";
import { describe, expect, it } from "vitest";

import { cssVariablesResolver, theme } from "./theme";

// `cssVariablesResolver` (like `MantineProvider`) is called with the full theme, defaults
// merged in — `theme` alone is a partial override and doesn't satisfy its type.
const fullTheme = mergeMantineTheme(DEFAULT_THEME, theme);

describe("theme", () => {
  it("uses the dawn palette as the primary color", () => {
    expect(theme.primaryColor).toBe("dawn");
  });
});

describe("cssVariablesResolver", () => {
  it("defines the same --ga-* keys for light and dark", () => {
    const { light, dark } = cssVariablesResolver(fullTheme);

    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  it("sets the dark text color from the dawn palette 4705", () => {
    const { dark } = cssVariablesResolver(fullTheme);

    expect(dark["--mantine-color-text"]).toBe("#ecebf5");
  });

  it("defines all five avatar token pairs in both schemes", () => {
    const { light, dark } = cssVariablesResolver(fullTheme);

    for (let index = 1; index <= 5; index += 1) {
      expect(light[`--ga-avatar-${index}-bg`]).toBeDefined();
      expect(light[`--ga-avatar-${index}-fg`]).toBeDefined();
      expect(dark[`--ga-avatar-${index}-bg`]).toBeDefined();
      expect(dark[`--ga-avatar-${index}-fg`]).toBeDefined();
    }
  });
});
