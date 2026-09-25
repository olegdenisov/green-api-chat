import { Paper } from "@mantine/core";

import { LoginForm } from "@/features/auth";
import { AppTitle } from "@/shared/ui";

import classes from "./login-page.module.css";

export function LoginPage() {
  return (
    <main className={classes.page}>
      <Paper withBorder shadow="sm" p="xl" radius="md" className={classes.card}>
        <AppTitle className={classes.title} />
        <LoginForm />
      </Paper>
    </main>
  );
}
