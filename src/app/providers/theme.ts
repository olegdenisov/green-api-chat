import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from "@mantine/core";

// Palette and surfaces are modelled on the MAX messenger web client (web.max.ru): a saturated
// blue accent, a light-grey / near-black chat background, blue outgoing and neutral incoming
// bubbles. The values are approximations chosen by eye from public MAX screenshots and brand
// colour: web.max.ru was not inspectable via DevTools while this theme was written.
// The logo and all icons are the project's own, not MAX trademarks.
const max: MantineColorsTuple = [
  "#eaf3ff",
  "#d3e5ff",
  "#a4c9ff",
  "#72acff",
  "#4a94ff",
  "#3084ff",
  "#1f7bff",
  "#0f68e4",
  "#025ecd",
  "#0052b6",
];

export const theme = createTheme({
  primaryColor: "max",
  primaryShade: { light: 7, dark: 7 },
  colors: { max },
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  defaultRadius: "md",
});

// Tokens Mantine has no equivalent for. CSS Modules use only Mantine variables and --ga-*.
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    // Mantine's default dimmed grey (#868e96) is 3.3:1 on white; a secondary text needs 4.5:1.
    "--mantine-color-dimmed": "#5c6470",
    "--ga-feed-bg": "#eef1f5",
    "--ga-bubble-in-bg": "#ffffff",
    "--ga-bubble-in-text": "#111418",
    "--ga-bubble-out-bg": "#0f68e4",
    "--ga-bubble-out-text": "#ffffff",
    "--ga-day-bg": "rgba(17, 20, 24, 0.08)",
    "--ga-day-text": "#4b5563",
  },
  dark: {
    // Mantine's dark dimmed (#828282) is 4:1 on the list background.
    "--mantine-color-dimmed": "#9aa0a6",
    "--ga-feed-bg": "#141518",
    "--ga-bubble-in-bg": "#26282d",
    "--ga-bubble-in-text": "#f1f3f5",
    "--ga-bubble-out-bg": "#1f68d1",
    "--ga-bubble-out-text": "#ffffff",
    "--ga-day-bg": "rgba(255, 255, 255, 0.1)",
    "--ga-day-text": "#adb5bd",
  },
});
