import { Button } from "@mantine/core";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";

import { logout } from "@/entities/session";

export const LogoutButton = reatomComponent(
  () => (
    <Button variant="subtle" onClick={wrap(() => logout())}>
      Выйти
    </Button>
  ),
  "auth.LogoutButton",
);
