import { connectLogger } from "@reatom/core";

// Side-effect module: must be the FIRST import in src/main.tsx.
// connectLogger() adds a global extension that is applied only to atoms/actions created
// after this call (no back-fill), and model atoms are created while their modules
// evaluate, so it has to run before any other app module is imported.
if (import.meta.env.MODE === "development") {
  connectLogger();
}
