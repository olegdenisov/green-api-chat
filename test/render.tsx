import { MantineProvider } from "@mantine/core";
import { context } from "@reatom/core";
import { reatomContext } from "@reatom/react";
import { render as testingLibraryRender, type RenderOptions } from "@testing-library/react";
import type { ReactNode } from "react";

// Providers are assembled here, not imported from @/app/providers, so tests
// control test-only options (env="test" disables transitions and portals).
//
// Reatom isolation: every render gets a fresh root frame from context.start(),
// so atom state never leaks between tests. clearStack() is called only in
// src/main.tsx, which tests must not import; the default global context stays
// available for code that runs outside a component.
export function render(ui: ReactNode, options?: Omit<RenderOptions, "wrapper">) {
  const frame = context.start();

  function Providers({ children }: { children: ReactNode }) {
    return (
      <reatomContext.Provider value={frame}>
        <MantineProvider env="test">{children}</MantineProvider>
      </reatomContext.Provider>
    );
  }

  return { frame, ...testingLibraryRender(ui, { wrapper: Providers, ...options }) };
}
