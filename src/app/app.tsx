// Mantine styles first, then our own: app styles and CSS Modules override Mantine.
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles/index.css";

import { HomePage } from "@/pages/home";

import { ReatomProvider } from "./providers/reatom-provider";
import { UiProvider } from "./providers/ui-provider";

export function App() {
  return (
    <ReatomProvider>
      <UiProvider>
        <HomePage />
      </UiProvider>
    </ReatomProvider>
  );
}
