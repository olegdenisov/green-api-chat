import { describe, expect, it } from "vitest";

import { formatChatTime, formatTime } from "./format-time";

describe("formatTime", () => {
  it("formats local hours and minutes with leading zeros", () => {
    expect(formatTime(new Date(2026, 8, 25, 9, 5).getTime())).toBe("09:05");
    expect(formatTime(new Date(2026, 8, 25, 23, 59).getTime())).toBe("23:59");
  });
});

describe("formatChatTime", () => {
  const now = new Date(2026, 8, 25, 12, 0).getTime();

  it("shows the time for today", () => {
    expect(formatChatTime(new Date(2026, 8, 25, 0, 1).getTime(), now)).toBe("00:01");
  });

  it("shows the date for other days", () => {
    expect(formatChatTime(new Date(2026, 8, 24, 23, 59).getTime(), now)).toBe("24.09.26");
    expect(formatChatTime(new Date(2025, 0, 3, 10, 0).getTime(), now)).toBe("03.01.25");
  });
});
