import { DEFAULT_THEME, mergeMantineTheme } from "@mantine/core";
import { describe, expect, it } from "vitest";

import { cssVariablesResolver, theme } from "./theme";

// `cssVariablesResolver` (like `MantineProvider`) is called with the full theme, defaults
// merged in — `theme` alone is a partial override and doesn't satisfy its type.
const fullTheme = mergeMantineTheme(DEFAULT_THEME, theme);

describe("cssVariablesResolver", () => {
  it("defines the same --ga-* keys for light and dark", () => {
    const { light, dark } = cssVariablesResolver(fullTheme);

    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });
});
