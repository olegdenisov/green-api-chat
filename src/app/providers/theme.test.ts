import { DEFAULT_THEME, mergeMantineTheme } from "@mantine/core";
import { describe, expect, it } from "vitest";

import { cssVariablesResolver, theme, variantColorResolver } from "./theme";

// `cssVariablesResolver` (like `MantineProvider`) is called with the full theme, defaults
// merged in — `theme` alone is a partial override and doesn't satisfy its type.
const fullTheme = mergeMantineTheme(DEFAULT_THEME, theme);

type Tokens = Record<string, string>;

// Tokens of one scheme as the browser sees them: shared `variables`, then the scheme's own.
function schemeTokens(scheme: "light" | "dark"): Tokens {
  const resolved = cssVariablesResolver(fullTheme);
  return { ...resolved.variables, ...resolved[scheme] };
}

// A token's colour: a hex value or a reference to a Mantine palette shade.
function resolveColor(tokens: Tokens, name: string): string {
  const value = tokens[name];
  if (value === undefined) throw new Error(`${name} is not defined`);
  const shade = /^var\(--mantine-color-([a-z]+)-(\d)\)$/.exec(value);
  if (shade) {
    const [, color, index] = shade;
    const palette = fullTheme.colors[color];
    if (!palette) throw new Error(`no palette ${color}`);
    return palette[Number(index)];
  }
  if (!/^#[0-9a-f]{6}$/.test(value)) throw new Error(`${name} is not a hex colour: ${value}`);
  return value;
}

// WCAG 2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("contrast helper", () => {
  it("computes WCAG ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1);
    // Mantine's red-6 on white: the reason --mantine-color-error is overridden.
    expect(contrast("#fa5252", "#ffffff")).toBeLessThan(4.5);
  });
});

describe("theme", () => {
  it("uses the lavender palette of mockup 5a as the primary color", () => {
    expect(theme.primaryColor).toBe("lavender");
    expect(fullTheme.colors.lavender[6]).toBe("#6c5ce7");
    expect(fullTheme.colors.lavender[3]).toBe("#b7adff");
  });
});

describe("variantColorResolver", () => {
  it("is the theme's resolver", () => {
    expect(fullTheme.variantColorResolver).toBe(variantColorResolver);
  });

  it.each([["lavender"], [undefined]])(
    "puts --ga-on-primary text on the filled primary (color %s)",
    (color) => {
      const colors = fullTheme.variantColorResolver({ color, variant: "filled", theme: fullTheme });

      expect(colors.color).toBe("var(--ga-on-primary)");
      expect(colors.background).toBe("var(--mantine-color-lavender-filled)");
    },
  );

  it("keeps white text on other filled colors", () => {
    const colors = fullTheme.variantColorResolver({
      color: "red",
      variant: "filled",
      theme: fullTheme,
    });

    expect(colors.color).toBe("var(--mantine-color-white)");
    expect(colors.background).toBe("var(--mantine-color-red-filled)");
  });

  it("leaves other variants of the primary to Mantine", () => {
    const colors = fullTheme.variantColorResolver({
      color: "lavender",
      variant: "light",
      theme: fullTheme,
    });

    expect(colors.color).toBe("var(--mantine-color-lavender-light-color)");
  });

  it("resolves the field variant to the neutral field background", () => {
    const colors = fullTheme.variantColorResolver({
      color: "lavender",
      variant: "field",
      theme: fullTheme,
    });

    expect(colors).toEqual({
      background: "var(--ga-field-bg)",
      hover: "var(--mantine-color-default-hover)",
      color: "var(--mantine-color-text)",
      border: "none",
    });
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

  it("sets the dark text color from palette 5a", () => {
    const { dark } = cssVariablesResolver(fullTheme);

    expect(dark["--mantine-color-text"]).toBe("#eeecf6");
  });

  it("uses #b7adff as the filled primary in dark", () => {
    const { dark } = cssVariablesResolver(fullTheme);

    expect(dark["--mantine-color-lavender-filled"]).toBe("#b7adff");
  });

  it("keeps a hover of variant='default' in dark distinct from its background", () => {
    const { dark } = cssVariablesResolver(fullTheme);

    // --mantine-color-default is dark-6 in the dark scheme.
    expect(dark["--mantine-color-default-hover"]).not.toBe(fullTheme.colors.dark[6]);
  });

  it("defines all five avatar token pairs, shared by both schemes", () => {
    const { variables, light, dark } = cssVariablesResolver(fullTheme);

    for (let index = 1; index <= 5; index += 1) {
      expect(variables[`--ga-avatar-${index}-bg`]).toMatch(/^#[0-9a-f]{6}$/);
      expect(variables[`--ga-avatar-${index}-fg`]).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const tokens of [variables, light, dark]) {
      // `AVATAR_COLOR_COUNT` in chat-avatar.tsx is 5: a sixth pair would never be used.
      expect(tokens["--ga-avatar-6-bg"]).toBeUndefined();
      expect(tokens["--ga-avatar-6-fg"]).toBeUndefined();
    }
  });
});

describe("contrast", () => {
  // Text / background pairs that must reach WCAG AA for normal text (4.5:1).
  const pairs: Array<[text: string, background: string]> = [
    ["--mantine-color-text", "--ga-surface"],
    ["--mantine-color-dimmed", "--ga-surface"],
    ["--mantine-color-dimmed", "--ga-feed-bg"],
    ["--mantine-color-dimmed", "--ga-primary-soft"],
    ["--mantine-color-error", "--ga-surface"],
    ["--mantine-color-error", "--ga-field-bg"],
    ["--ga-bubble-in-text", "--ga-bubble-in-bg"],
    ["--ga-bubble-out-text", "--ga-bubble-out-bg"],
    ["--ga-bubble-out-meta", "--ga-bubble-out-bg"],
    ["--ga-bubble-out-meta", "--ga-bubble-failed-bg"],
    ["--ga-danger-text", "--ga-bubble-failed-bg"],
    ["--ga-danger-text", "--ga-surface"],
    ["--ga-primary-soft-text", "--ga-primary-soft"],
    ["--ga-day-text", "--ga-day-bg"],
    ["--ga-warning-text", "--ga-warning-bg"],
    ["--ga-on-primary", "--mantine-color-lavender-filled"],
    ["--ga-on-primary", "--mantine-color-lavender-filled-hover"],
    ...[1, 2, 3, 4, 5].map((index): [string, string] => [
      `--ga-avatar-${index}-fg`,
      `--ga-avatar-${index}-bg`,
    ]),
  ];

  describe.each(["light", "dark"] as const)("%s scheme", (scheme) => {
    const tokens = schemeTokens(scheme);

    it.each(pairs)("%s on %s is at least 4.5:1", (text, background) => {
      const ratio = contrast(resolveColor(tokens, text), resolveColor(tokens, background));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("white on the red filled button (e.g. «Удалить») is at least 4.5:1", () => {
      for (const name of ["--mantine-color-red-filled", "--mantine-color-red-filled-hover"]) {
        expect(contrast("#ffffff", resolveColor(tokens, name))).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  it("the dark anchor color (lavender-4) is readable on the dark surface", () => {
    const tokens = schemeTokens("dark");

    expect(
      contrast(fullTheme.colors.lavender[4], resolveColor(tokens, "--ga-surface")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
