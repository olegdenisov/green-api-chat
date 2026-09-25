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
  {
    // Temporary, until Task 5 of stage 3: the slices have no consumers yet, so the rule
    // flags them as insignificant. Remove once pages and app import them.
    files: ["./src/entities/session/**", "./src/features/auth/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
]);
