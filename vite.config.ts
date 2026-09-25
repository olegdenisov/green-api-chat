import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
// https://vitest.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    unstubGlobals: true,
    // `vi.spyOn` spies are restored before every test: no manual `mockRestore()`.
    restoreMocks: true,
  },
});
