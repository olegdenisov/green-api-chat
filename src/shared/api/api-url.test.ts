import { describe, expect, it } from "vitest";

import { resolveApiUrl } from "./api-url";

describe("resolveApiUrl", () => {
  it("builds the host from the first 4 digits", () => {
    expect(resolveApiUrl("4100000000")).toBe("https://4100.api.green-api.com");
  });

  it("trims surrounding whitespace", () => {
    expect(resolveApiUrl("  7103123456 \n")).toBe("https://7103.api.green-api.com");
  });

  it("accepts exactly 4 digits", () => {
    expect(resolveApiUrl("1101")).toBe("https://1101.api.green-api.com");
  });

  it("returns undefined for fewer than 4 digits", () => {
    expect(resolveApiUrl("410")).toBeUndefined();
    expect(resolveApiUrl(" 410 ")).toBeUndefined();
  });

  it("returns undefined for non-digits", () => {
    expect(resolveApiUrl("41a0000000")).toBeUndefined();
    expect(resolveApiUrl("4100 000000")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(resolveApiUrl("")).toBeUndefined();
    expect(resolveApiUrl("   ")).toBeUndefined();
  });
});
