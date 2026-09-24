import { context } from "@reatom/core";
import { reatomContext } from "@reatom/react";
import { useState, type ReactNode } from "react";

// Root frame per provider instance: https://v1001.reatom.dev/reference/react/
// Lazy useState keeps one frame for the provider's lifetime and gives every mounted
// App its own isolated context (no module-level singleton shared between tests).
// clearStack() lives in src/main.tsx so modules imported by tests stay side-effect free.
export function ReatomProvider({ children }: { children: ReactNode }) {
  const [frame] = useState(() => context.start());

  return <reatomContext.Provider value={frame}>{children}</reatomContext.Provider>;
}
