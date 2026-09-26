import { ActionIcon, Tooltip } from "@mantine/core";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";

import { logout } from "@/entities/session";
import { IconLogout } from "@/shared/ui";

export const LogoutButton = reatomComponent(
  () => (
    <Tooltip label="Выйти">
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        aria-label="Выйти"
        onClick={wrap(() => logout())}
      >
        <IconLogout />
      </ActionIcon>
    </Tooltip>
  ),
  "auth.LogoutButton",
);
