// Node's fs: stylesheets come in empty through Vite's `?raw` in tests (Vitest does not process CSS).
/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_THEME, mergeMantineTheme } from "@mantine/core";
import { describe, expect, it } from "vitest";

import { cssVariablesResolver, theme } from "./theme";

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

describe("theme", () => {
  it("uses the lavender palette of mockup 5a as the primary color", () => {
    expect(theme.primaryColor).toBe("lavender");
    expect(fullTheme.colors.lavender[6]).toBe("#6c5ce7");
    expect(fullTheme.colors.lavender[3]).toBe("#b7adff");
  });
});

describe("variantColorResolver", () => {
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

  it("gives every --ga-* token a colour value (hex or rgba)", () => {
    const { variables, light, dark } = cssVariablesResolver(fullTheme);

    for (const tokens of [variables, light, dark]) {
      for (const [name, value] of Object.entries(tokens)) {
        if (!name.startsWith("--ga-")) continue;
        expect(value).toMatch(/^#[0-9a-f]{6}$|^rgba\(\d+, \d+, \d+, (0|1|0?\.\d+)\)$/);
      }
    }
  });

  it("defines all five avatar token pairs, shared by both schemes", () => {
    const { variables } = cssVariablesResolver(fullTheme);

    for (let index = 1; index <= 5; index += 1) {
      expect(variables[`--ga-avatar-${index}-bg`]).toMatch(/^#[0-9a-f]{6}$/);
      expect(variables[`--ga-avatar-${index}-fg`]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  // A removed or misspelled token would silently fall back to transparent/inherited.
  it("defines every --ga-* token the stylesheets read", () => {
    // Vitest runs from the project root.
    const stylesheets = readdirSync("src", { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".css"))
      .map((file): [string, string] => [file, readFileSync(join("src", file), "utf8")]);
    const { variables, light, dark } = cssVariablesResolver(fullTheme);
    const defined = new Set([
      ...Object.keys(variables),
      ...Object.keys(light),
      ...Object.keys(dark),
    ]);

    const used = stylesheets.flatMap(([file, css]) =>
      [...css.matchAll(/var\((--ga-[a-z0-9-]+)/g)].map(([, name]) => `${file}: ${name}`),
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((entry) => !defined.has(entry.split(": ")[1]))).toEqual([]);
  });

  it("duplicates the app background and text in the pre-mount CSS and theme-color", () => {
    const indexCss = readFileSync("src/app/styles/index.css", "utf8");
    const indexHtml = readFileSync("index.html", "utf8");

    for (const scheme of ["light", "dark"] as const) {
      const tokens = schemeTokens(scheme);
      expect(indexCss).toContain(`background-color: ${tokens["--ga-app-bg"]};`);
      expect(indexCss).toContain(`color: ${tokens["--mantine-color-text"]};`);
      expect(indexHtml).toContain(
        `content="${tokens["--ga-app-bg"]}" media="(prefers-color-scheme: ${scheme})"`,
      );
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
    ["--mantine-color-dimmed", "--ga-field-bg"],
    ["--mantine-color-text", "--ga-primary-soft"],
    ["--mantine-color-text", "--ga-field-bg"],
    ["--mantine-color-placeholder", "--ga-surface"],
    ["--mantine-color-placeholder", "--ga-field-bg"],
    ["--mantine-color-error", "--ga-surface"],
    ["--mantine-color-error", "--ga-field-bg"],
    ["--ga-bubble-in-text", "--ga-bubble-in-bg"],
    ["--ga-bubble-in-meta", "--ga-bubble-in-bg"],
    ["--ga-bubble-out-text", "--ga-bubble-out-bg"],
    ["--ga-bubble-out-text", "--ga-bubble-failed-bg"],
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

    // WCAG 1.4.11: non-text contrast of icons and the focus ring.
    it.each([
      ["--ga-status-read", "--ga-bubble-out-bg"],
      ["--mantine-color-lavender-filled", "--ga-surface"],
      ["--mantine-color-lavender-filled", "--ga-feed-bg"],
    ])("%s on %s is at least 3:1", (graphic, background) => {
      const ratio = contrast(resolveColor(tokens, graphic), resolveColor(tokens, background));
      expect(ratio).toBeGreaterThanOrEqual(3);
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
