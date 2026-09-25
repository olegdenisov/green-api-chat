// Mantine styles first, then our own: app styles and CSS Modules override Mantine.
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles/index.css";

import { reatomComponent } from "@reatom/react";

import { credentialsAtom } from "@/entities/session";
import { ChatPage } from "@/pages/chat";
import { LoginPage } from "@/pages/login";

import { ReatomProvider } from "./providers/reatom-provider";
import { UiProvider } from "./providers/ui-provider";
// Side effect: logout wipes chats and messages.
import "./user-data-cleanup";

// Two screens, no router: the chat opens as soon as credentials are saved.
// Kept here, not in an app/ui folder: steiger's fsd/no-ui-in-app forbids it.
const Screen = reatomComponent(
  () => (credentialsAtom() ? <ChatPage /> : <LoginPage />),
  "app.Screen",
);

export function App() {
  return (
    <ReatomProvider>
      <UiProvider>
        <Screen />
      </UiProvider>
    </ReatomProvider>
  );
}
