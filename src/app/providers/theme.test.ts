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
  it("defines the same keys for light and dark, none of them also shared", () => {
    const { variables, light, dark } = cssVariablesResolver(fullTheme);

    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
    for (const key of Object.keys(variables)) {
      expect(light).not.toHaveProperty(key);
    }
  });

  it("sets the dark text color from the dawn palette 4705", () => {
    const { dark } = cssVariablesResolver(fullTheme);

    expect(dark["--mantine-color-text"]).toBe("#ecebf5");
  });

  it("defines all five avatar token pairs in each scheme", () => {
    const { variables, light, dark } = cssVariablesResolver(fullTheme);

    for (const scheme of [light, dark]) {
      const tokens = { ...variables, ...scheme };
      for (let index = 1; index <= 5; index += 1) {
        expect(tokens[`--ga-avatar-${index}-bg`]).toMatch(/^#[0-9a-f]{6}$/);
        expect(tokens[`--ga-avatar-${index}-fg`]).toMatch(/^#[0-9a-f]{6}$/);
      }
      // `AVATAR_COLOR_COUNT` in chat-avatar.tsx is 5: a sixth pair would never be used.
      expect(tokens["--ga-avatar-6-bg"]).toBeUndefined();
      expect(tokens["--ga-avatar-6-fg"]).toBeUndefined();
    }
  });

  it("gives the first avatar a lighter tint in dark", () => {
    const { light, dark } = cssVariablesResolver(fullTheme);

    expect(dark["--ga-avatar-1-bg"]).toBe("#4f5a96");
    expect(light["--ga-avatar-1-bg"]).toBe("#3c487c");
  });
});
