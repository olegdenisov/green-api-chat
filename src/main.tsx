import { clearStack } from "@reatom/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/app";

// Disable the default global context: every Reatom call must run inside the
// provider's frame or be wrap()-ed. Kept in the entry point, which tests never import.
clearStack();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
