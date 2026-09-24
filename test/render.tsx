import { MantineProvider } from "@mantine/core";
import { render as testingLibraryRender, type RenderOptions } from "@testing-library/react";
import type { ReactNode } from "react";

// Providers are assembled here, not imported from @/app/providers, so tests
// control test-only options (env="test" disables transitions and portals).
function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test">{children}</MantineProvider>;
}

export function render(ui: ReactNode, options?: Omit<RenderOptions, "wrapper">) {
  return testingLibraryRender(ui, { wrapper: Providers, ...options });
}
