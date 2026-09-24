import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library auto-cleanup needs global afterEach; vitest globals are off.
afterEach(() => {
  cleanup();
});
