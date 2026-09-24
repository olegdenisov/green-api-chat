import { connectLogger, context } from "@reatom/core";
import { reatomContext } from "@reatom/react";
import type { ReactNode } from "react";

// Root frame of the app: https://v1001.reatom.dev/reference/react/
// clearStack() lives in src/main.tsx so modules imported by tests stay side-effect free.
const rootFrame = context.start();

if (import.meta.env.MODE === "development") {
  rootFrame.run(connectLogger);
}

export function ReatomProvider({ children }: { children: ReactNode }) {
  return <reatomContext.Provider value={rootFrame}>{children}</reatomContext.Provider>;
}
