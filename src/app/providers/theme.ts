import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from "@mantine/core";

// Palette based on color.romanuke.com palette #4705 (indigo, lavender, peach, powder pink:
// #3C487C #797EBA #A7A0C9 #F8D4C4 #E5B1B9), replacing the earlier "MAX-inspired" blue accent.
const dawn: MantineColorsTuple = [
  "#eeeff7",
  "#dcdef0",
  "#b9bde0",
  "#979dcf",
  "#797eba",
  "#5f67a6",
  "#4f5a96",
  "#3c487c",
  "#323c68",
  "#283054",
];

// A cool dark scale with an indigo tint, in place of Mantine's neutral dark (#242424 etc.), so
// chrome and the feed share the same colour family.
const dark: MantineColorsTuple = [
  "#ecebf5",
  "#c9c4e2",
  "#a7a0c9",
  "#8d8aa6",
  "#363a58",
  "#2c2f47",
  "#22253a",
  "#1a1c2b",
  "#141522",
  "#0f1019",
];

export const theme = createTheme({
  primaryColor: "dawn",
  primaryShade: { light: 7, dark: 6 },
  colors: { dawn, dark },
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  defaultRadius: "md",
});

// Tokens Mantine has no equivalent for. CSS Modules use only Mantine variables and --ga-*.
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-text": "#1e2340",
    // Mantine's default dimmed grey (#868e96) is 3.3:1 on white; a secondary text needs 4.5:1.
    "--mantine-color-dimmed": "#5c5f7a",
    "--mantine-color-body": "#ffffff",
    "--mantine-color-default-border": "#e4e1ee",
    "--mantine-color-default-hover": "#f3f1f7",
    "--ga-feed-bg": "#f3f1f7",
    "--ga-bubble-in-bg": "#ffffff",
    "--ga-bubble-in-text": "#1e2340",
    "--ga-bubble-in-meta": "#5c5f7a",
    "--ga-bubble-out-bg": "#3c487c",
    "--ga-bubble-out-text": "#ffffff",
    "--ga-bubble-out-meta": "#dcdef0",
    "--ga-bubble-failed-bg": "#fbe8eb",
    "--ga-bubble-failed-border": "#e5b1b9",
    "--ga-bubble-failed-text": "#1e2340",
    "--ga-bubble-failed-meta": "#8a2537",
    "--ga-status-read": "#f8d4c4",
    "--ga-day-bg": "#f8d4c4",
    "--ga-day-text": "#6b4638",
    "--ga-bubble-shadow": "rgba(30, 35, 64, 0.08)",
    "--ga-row-active-bg": "#ebe9f4",
    "--ga-row-active-bar": "#797eba",
    "--ga-row-active-time": "#3c487c",
    "--ga-send-disabled-bg": "#ebe9f4",
    "--ga-send-disabled-icon": "#797eba",
    "--ga-avatar-1-bg": "#3c487c",
    "--ga-avatar-1-fg": "#ffffff",
    "--ga-avatar-2-bg": "#797eba",
    "--ga-avatar-2-fg": "#ffffff",
    "--ga-avatar-3-bg": "#a7a0c9",
    "--ga-avatar-3-fg": "#1e2340",
    "--ga-avatar-4-bg": "#f8d4c4",
    "--ga-avatar-4-fg": "#3c487c",
    "--ga-avatar-5-bg": "#e5b1b9",
    "--ga-avatar-5-fg": "#1e2340",
  },
  dark: {
    "--mantine-color-text": "#ecebf5",
    // ~7:1 on #1a1c2b.
    "--mantine-color-dimmed": "#a7a0c9",
    "--mantine-color-body": "#1a1c2b",
    "--mantine-color-default-border": "#2c2f47",
    // dark-6 (== --mantine-color-default): variant="default" would lose its hover on #22253a.
    "--mantine-color-default-hover": "#2c2f47",
    "--ga-feed-bg": "#141522",
    "--ga-bubble-in-bg": "#262a40",
    "--ga-bubble-in-text": "#ecebf5",
    "--ga-bubble-in-meta": "#a7a0c9",
    "--ga-bubble-out-bg": "#4f5a96",
    "--ga-bubble-out-text": "#ffffff",
    "--ga-bubble-out-meta": "#e4e5f3",
    "--ga-bubble-failed-bg": "#3a2233",
    "--ga-bubble-failed-border": "#6a3a4c",
    "--ga-bubble-failed-text": "#ecebf5",
    "--ga-bubble-failed-meta": "#e5b1b9",
    "--ga-status-read": "#f8d4c4",
    "--ga-day-bg": "rgba(248, 212, 196, 0.14)",
    "--ga-day-text": "#f8d4c4",
    "--ga-bubble-shadow": "rgba(0, 0, 0, 0.32)",
    "--ga-row-active-bg": "#272a45",
    "--ga-row-active-bar": "#797eba",
    "--ga-row-active-time": "#c9c4e2",
    "--ga-send-disabled-bg": "#272a45",
    "--ga-send-disabled-icon": "#797eba",
    // The first avatar pair gets a lighter dark-scheme tint; the rest stay as in light.
    "--ga-avatar-1-bg": "#4f5a96",
    "--ga-avatar-1-fg": "#ffffff",
    "--ga-avatar-2-bg": "#797eba",
    "--ga-avatar-2-fg": "#ffffff",
    "--ga-avatar-3-bg": "#a7a0c9",
    "--ga-avatar-3-fg": "#1e2340",
    "--ga-avatar-4-bg": "#f8d4c4",
    "--ga-avatar-4-fg": "#3c487c",
    "--ga-avatar-5-bg": "#e5b1b9",
    "--ga-avatar-5-fg": "#1e2340",
  },
});
