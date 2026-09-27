import { Title, type TitleProps } from "@mantine/core";

import classes from "./app-title.module.css";

/** App name as the page heading (`h1`). */
export function AppTitle({ className, ...props }: Omit<TitleProps, "order" | "children">) {
  return (
    <Title
      order={1}
      className={className ? `${classes.title} ${className}` : classes.title}
      {...props}
    >
      GREEN-API chat
    </Title>
  );
}
