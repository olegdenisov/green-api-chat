import { Text, Title } from "@mantine/core";

import { LogoutButton } from "@/features/auth";

import classes from "./chat-page.module.css";

/** Chat screen stub: filled in by stage 4. */
export function ChatPage() {
  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <Title order={1} size="h3" className={classes.title}>
          GREEN-API chat
        </Title>
        <LogoutButton />
      </header>
      <main className={classes.body}>
        <Text c="dimmed">Чаты появятся здесь</Text>
      </main>
    </div>
  );
}
