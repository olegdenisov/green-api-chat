import { context } from "@reatom/core";
import { reatomContext } from "@reatom/react";
import { useState, type ReactNode } from "react";

// Root frame per provider instance: https://v1001.reatom.dev/reference/react/
// Lazy useState runs context.start() once per mount, so each provider instance owns one frame.
export function ReatomProvider({ children }: { children: ReactNode }) {
  const [frame] = useState(() => context.start());

  return <reatomContext.Provider value={frame}>{children}</reatomContext.Provider>;
}
