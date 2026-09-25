import { Text } from "@mantine/core";

import { LogoutButton } from "@/features/auth";
import { AppTitle } from "@/shared/ui";

import classes from "./chat-page.module.css";

/** Chat screen stub: filled in by stage 4. */
export function ChatPage() {
  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <AppTitle size="h3" />
        <LogoutButton />
      </header>
      <main className={classes.body}>
        <Text c="dimmed">Чаты появятся здесь</Text>
      </main>
    </div>
  );
}
