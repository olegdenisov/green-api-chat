// Mantine styles first, then our own: app styles and CSS Modules override Mantine.
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles/index.css";

import { Title } from "@mantine/core";

import { ReatomProvider } from "./providers/reatom-provider";
import { UiProvider } from "./providers/ui-provider";

function App() {
  return (
    <ReatomProvider>
      <UiProvider>
        <Title order={1}>GREEN-API chat</Title>
      </UiProvider>
    </ReatomProvider>
  );
}

export default App;
