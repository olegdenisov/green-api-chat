import { Paper, Title } from "@mantine/core";

import { LoginForm } from "@/features/auth";

import classes from "./login-page.module.css";

export function LoginPage() {
  return (
    <main className={classes.page}>
      <Paper withBorder shadow="sm" p="xl" radius="md" className={classes.card}>
        <Title order={1} className={classes.title}>
          GREEN-API chat
        </Title>
        <LoginForm />
      </Paper>
    </main>
  );
}
