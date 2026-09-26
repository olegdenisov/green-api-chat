import { Text } from "@mantine/core";

import { IconLogo } from "@/shared/ui";

import classes from "./empty-state.module.css";

/** Icon and a caption in the middle of a column: no chats, no chat selected, no messages. */
export function EmptyState({ children }: { children: string }) {
  return (
    <div className={classes.root}>
      <IconLogo size={40} />
      <Text c="dimmed" size="sm">
        {children}
      </Text>
    </div>
  );
}
