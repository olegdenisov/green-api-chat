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
    // Temporary, stage 4: new slices have fewer than two consumers until their pages/features
    // land, so the rule flags them as insignificant. Each entry goes away with its consumers
    // (see the exceptions table in docs/plans/20260925-04-chats-and-sending.md).
    files: ["./src/entities/chat/**"],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
]);
