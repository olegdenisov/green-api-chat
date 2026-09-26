import { describe, expect, it } from "vitest";

import { formatChatTime, formatDayLabel, formatTime } from "./format-time";

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

describe("formatDayLabel", () => {
  const now = new Date(2026, 8, 25, 12, 0).getTime();

  it("labels today", () => {
    expect(formatDayLabel(new Date(2026, 8, 25, 0, 1).getTime(), now)).toBe("Сегодня");
    expect(formatDayLabel(new Date(2026, 8, 25, 23, 59).getTime(), now)).toBe("Сегодня");
  });

  it("labels yesterday", () => {
    expect(formatDayLabel(new Date(2026, 8, 24, 23, 59).getTime(), now)).toBe("Вчера");
  });

  it("labels yesterday on the 1st of a month", () => {
    const first = new Date(2026, 9, 1, 12, 0).getTime();
    expect(formatDayLabel(new Date(2026, 8, 30, 10, 0).getTime(), first)).toBe("Вчера");
    expect(formatDayLabel(new Date(2026, 8, 29, 10, 0).getTime(), first)).toBe("29 сентября");
  });

  it("labels yesterday on 1 January", () => {
    const newYear = new Date(2026, 0, 1, 12, 0).getTime();
    expect(formatDayLabel(new Date(2025, 11, 31, 23, 0).getTime(), newYear)).toBe("Вчера");
  });

  it("shows day and month in the genitive within the same year", () => {
    expect(formatDayLabel(new Date(2026, 8, 23, 10, 0).getTime(), now)).toBe("23 сентября");
    expect(formatDayLabel(new Date(2026, 0, 3, 10, 0).getTime(), now)).toBe("3 января");
  });

  it("appends the year for another year, without «г.»", () => {
    expect(formatDayLabel(new Date(2025, 0, 3, 10, 0).getTime(), now)).toBe("3 января 2025");
  });
});
