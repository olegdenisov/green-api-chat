import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // app/providers is the agreed place for app-wide providers (see the stage 1 plan);
    // the rule flags the segment name only, so it is disabled for this folder alone.
    files: ["./src/app/providers/**"],
    rules: {
      "fsd/segments-by-purpose": "off",
    },
  },
]);
