import { Anchor, Paper, Text } from "@mantine/core";

import { LoginForm } from "@/features/auth";
import { AppTitle, IconMessageCircle } from "@/shared/ui";

import classes from "./login-page.module.css";

const CONSOLE_URL = "https://console.green-api.com";

export function LoginPage() {
  return (
    <main className={classes.page}>
      <Paper p="xl" radius={22} className={classes.card}>
        <div className={classes.logo}>
          <IconMessageCircle size={28} />
        </div>
        <AppTitle className={classes.title} />
        <Text size="sm" c="dimmed" className={classes.hint}>
          Возьмите idInstance и apiTokenInstance в{" "}
          <Anchor href={CONSOLE_URL} target="_blank" rel="noreferrer">
            консоли GREEN-API
          </Anchor>
          .
        </Text>
        <LoginForm />
      </Paper>
    </main>
  );
}
