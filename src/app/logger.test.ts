import { EXTENSIONS } from "@reatom/core";
import { afterEach, describe, expect, it, vi } from "vitest";

const mainSource = Object.values(
  import.meta.glob<string>("../main.tsx", { query: "?raw", import: "default", eager: true }),
)[0];

describe("dev logger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // connectLogger() does not back-fill atoms created before it, so the logger module
  // has to be evaluated before any module that creates atoms.
  it("is the first import in src/main.tsx", () => {
    const firstImport = /^import\s+(?:[^"']*\s+from\s+)?["']([^"']+)["']/m.exec(mainSource);

    expect(firstImport?.[1]).toBe("@/app/logger");
  });

  it("registers a global extension only in development", async () => {
    const before = EXTENSIONS.length;

    vi.stubEnv("MODE", "test");
    await import("./logger");
    expect(EXTENSIONS.length).toBe(before);

    vi.resetModules();
    vi.stubEnv("MODE", "development");
    await import("./logger");
    expect(EXTENSIONS.length).toBe(before + 1);

    EXTENSIONS.pop();
  });
});
