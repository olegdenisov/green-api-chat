import { Title } from "@mantine/core";

import classes from "./home-page.module.css";

export function HomePage() {
  return (
    <Title order={1} className={classes.title}>
      GREEN-API chat
    </Title>
  );
}
