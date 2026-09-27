import {
  ActionIcon,
  Button,
  createTheme,
  defaultVariantColorsResolver,
  Input,
  Notification,
  Popover,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  type VariantColorsResolver,
} from "@mantine/core";

// "Minimal Pastel" palette, mockup 5a (docs/design/pastel-5a/): pastel backgrounds and a single
// saturated accent #6C5CE7. [6] = #6C5CE7 (primary, light), [3] = #B7ADFF (primary, dark — set
// through cssVariablesResolver), [4] = #9A8CF7 (primary hover, dark), [7] = #5A4BC9 (text on
// soft backgrounds), [8] = #4A3BB5 (first avatar initials).
const lavender: MantineColorsTuple = [
  "#f3f1ff",
  "#e9e5ff",
  "#d4ccff",
  "#b7adff",
  "#9a8cf7",
  "#8374ef",
  "#6c5ce7",
  "#5a4bc9",
  "#4a3bb5",
  "#3a2d94",
];

// A dark scale with a violet tint, in place of Mantine's neutral dark (#242424 etc.), so the
// cards and the feed share the palette's colour family. [7] — surface (= body in dark),
// [8] — feed, [9] — app background; [6] — --mantine-color-default.
const dark: MantineColorsTuple = [
  "#eeecf6",
  "#c9c6d8",
  "#a6a3b8",
  "#8c89a0",
  "#3a3848",
  "#2e2c3a",
  "#24232f",
  "#1b1a24",
  "#16151e",
  "#121119",
];

// Class of the focus ring for every focusable Mantine component (in place of
// .mantine-focus-auto); the ring itself is in src/app/styles/index.css.
export const FOCUS_CLASS_NAME = "ga-focus";

// Mantine's resolver with two changes:
// - `filled` in the primary colour: text is --ga-on-primary, not a hardcoded white — the dark
//   primary (#b7adff) needs dark text (white on it is 2:1; `autoContrast` ignores the scheme);
// - `field`: a neutral icon button on the field background (logout, «Назад», chat deletion).
export const variantColorResolver: VariantColorsResolver = (input) => {
  if (input.variant === "field") {
    return {
      background: "var(--ga-field-bg)",
      hover: "var(--mantine-color-default-hover)",
      color: "var(--mantine-color-text)",
      border: "none",
    };
  }
  // Components pass `color || theme.primaryColor`; the fallback covers direct calls.
  const color = input.color ?? input.theme.primaryColor;
  const colors = defaultVariantColorsResolver({ ...input, color });
  if (input.variant === "filled" && color === input.theme.primaryColor) {
    return { ...colors, color: "var(--ga-on-primary)" };
  }
  return colors;
};

export const theme = createTheme({
  primaryColor: "lavender",
  // `primaryShade` applies to every colour, not just the primary one: dark 3 would make
  // red-filled #ff8787 (white on it is 2.3:1). So dark keeps Mantine's 8, and the light primary
  // of the dark scheme (#b7adff) comes from overriding --mantine-color-lavender-filled below.
  primaryShade: { light: 6, dark: 8 },
  colors: { lavender, dark },
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  defaultRadius: 14,
  variantColorResolver,
  focusClassName: FOCUS_CLASS_NAME,
  components: {
    ActionIcon: ActionIcon.extend({ defaultProps: { radius: 12 } }),
    // `filled`: no border, primary border on focus and error border stay Mantine's
    // (--input-bd is untouched). Only the background comes from the palette; `unstyled`
    // (the composer) keeps its transparent one. `styles`, not `vars`: Input's typed vars
    // don't include --input-bg; both end up in the wrapper's inline style.
    Input: Input.extend({
      defaultProps: { variant: "filled" },
      styles: (_theme, props) => ({
        wrapper: props.variant === "unstyled" ? {} : { "--input-bg": "var(--ga-field-bg)" },
      }),
    }),
    Button: Button.extend({ defaultProps: { radius: 14 } }),
    Popover: Popover.extend({ defaultProps: { radius: 14 } }),
    Notification: Notification.extend({ defaultProps: { radius: 14 } }),
  },
});

// Tokens Mantine has no equivalent for. CSS Modules use only Mantine variables and --ga-*.
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  // The same in both schemes; `light`/`dark` hold only what differs.
  variables: {
    // Avatar pairs 1..5: their number is `AVATAR_COLOR_COUNT` in chat-avatar.tsx — change them
    // together (theme.test.ts checks that pair 6 does not exist).
    "--ga-avatar-1-bg": "#e9e5ff",
    "--ga-avatar-1-fg": "#4a3bb5",
    "--ga-avatar-2-bg": "#ffe3d3",
    "--ga-avatar-2-fg": "#8a3e1b",
    "--ga-avatar-3-bg": "#d7f5e6",
    "--ga-avatar-3-fg": "#1c6b4a",
    "--ga-avatar-4-bg": "#dcebff",
    "--ga-avatar-4-fg": "#1f4e8c",
    "--ga-avatar-5-bg": "#fff1c2",
    "--ga-avatar-5-fg": "#7a5a00",
  },
  light: {
    "--mantine-color-text": "#1d1b2e",
    // Mantine's default dimmed grey (#868e96) is 3.3:1 on white; a secondary text needs 4.5:1.
    "--mantine-color-dimmed": "#6b6880",
    "--mantine-color-body": "#ffffff",
    // Placeholder only: 3.5:1 on white — not for text that must be read.
    "--mantine-color-placeholder": "#8a879c",
    // Mantine's red-6 (#fa5252) is 3.3:1 on white.
    "--mantine-color-error": "#b42336",
    "--mantine-color-default-border": "#e4e0f2",
    "--mantine-color-default-hover": "#ebe8f5",
    // With primaryShade.light 6, red-filled is red-6 (#fa5252): white on it is 3.3:1. Red-8
    // (as in dark) gives 4.5:1.
    "--mantine-color-red-filled": "var(--mantine-color-red-8)",
    "--mantine-color-red-filled-hover": "var(--mantine-color-red-9)",
    // The same as Mantine's light default; set so the dark override has a pair.
    "--mantine-color-lavender-filled": "var(--mantine-color-lavender-6)",
    "--mantine-color-lavender-filled-hover": "var(--mantine-color-lavender-7)",
    "--ga-app-bg": "#f7f5fc",
    "--ga-surface": "#ffffff",
    "--ga-feed-bg": "#fbfafe",
    "--ga-field-bg": "#f4f2fa",
    "--ga-border": "#f0eef6",
    // Text and icons on the filled primary.
    "--ga-on-primary": "#ffffff",
    "--ga-primary-soft": "#f1eeff",
    // Primary #6c5ce7 on the soft background is 4.3:1; a darker shade reads at 5.6:1.
    "--ga-primary-soft-text": "#5a4bc9",
    "--ga-bubble-in-bg": "#ffffff",
    "--ga-bubble-in-text": "#1d1b2e",
    "--ga-bubble-in-meta": "#6b6880",
    "--ga-bubble-out-bg": "#e9e5ff",
    "--ga-bubble-out-text": "#1d1b2e",
    "--ga-bubble-out-meta": "#5e5a7a",
    "--ga-bubble-failed-bg": "#ffe0e3",
    "--ga-danger-text": "#b42336",
    "--ga-status-read": "#6c5ce7",
    "--ga-warning-bg": "#fff1c2",
    "--ga-warning-text": "#7a5a00",
    "--ga-day-bg": "#f1eeff",
    "--ga-day-text": "#5a4bc9",
    "--ga-composer-shadow": "rgba(60, 50, 120, 0.08)",
  },
  dark: {
    "--mantine-color-text": "#eeecf6",
    "--mantine-color-dimmed": "#a6a3b8",
    "--mantine-color-body": "#1b1a24",
    "--mantine-color-placeholder": "#8c89a0",
    "--mantine-color-error": "#ff9aa6",
    "--mantine-color-default-border": "#34323f",
    // Not dark-6 (== --mantine-color-default): variant="default" would lose its hover.
    "--mantine-color-default-hover": "#2e2c3a",
    // Mantine's dark default, repeated so both schemes define the same keys.
    "--mantine-color-red-filled": "var(--mantine-color-red-8)",
    "--mantine-color-red-filled-hover": "var(--mantine-color-red-9)",
    // The dark primary is the light lavender-3 with dark text on it (--ga-on-primary);
    // --mantine-primary-color-filled refers to these.
    "--mantine-color-lavender-filled": "#b7adff",
    "--mantine-color-lavender-filled-hover": "#9a8cf7",
    "--ga-app-bg": "#121119",
    "--ga-surface": "#1b1a24",
    "--ga-feed-bg": "#16151e",
    "--ga-field-bg": "#24232f",
    "--ga-border": "#26252f",
    "--ga-on-primary": "#1d1b2e",
    "--ga-primary-soft": "#2a2640",
    "--ga-primary-soft-text": "#c9c1ff",
    "--ga-bubble-in-bg": "#24232f",
    "--ga-bubble-in-text": "#eeecf6",
    "--ga-bubble-in-meta": "#a6a3b8",
    "--ga-bubble-out-bg": "#3a3366",
    "--ga-bubble-out-text": "#f4f2ff",
    "--ga-bubble-out-meta": "#c9c1ff",
    "--ga-bubble-failed-bg": "#3d2229",
    "--ga-danger-text": "#ff9aa6",
    "--ga-status-read": "#b7adff",
    "--ga-warning-bg": "#3a3120",
    "--ga-warning-text": "#ffd98a",
    "--ga-day-bg": "#2a2640",
    "--ga-day-text": "#c9c1ff",
    "--ga-composer-shadow": "rgba(0, 0, 0, 0.32)",
  },
});
