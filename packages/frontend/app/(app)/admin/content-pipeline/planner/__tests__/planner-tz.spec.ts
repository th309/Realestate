import { describe, it, expect } from "vitest";
import {
  etDayKey,
  etTimeParts,
  etWallClockToUtcIso,
  weekKeys,
  keyWeekday,
  addDaysToKey,
  addMonthsToKey,
  monthGridKeys,
  startOfWeekKey,
} from "../planner-tz";

describe("etWallClockToUtcIso (ET wall-clock → UTC)", () => {
  it("summer EDT (-4): 9:00 AM ET → 13:00Z", () => {
    expect(etWallClockToUtcIso("2026-07-15", 9, 0)).toBe(
      "2026-07-15T13:00:00.000Z",
    );
  });

  it("winter EST (-5): 9:00 AM ET → 14:00Z", () => {
    expect(etWallClockToUtcIso("2026-01-15", 9, 0)).toBe(
      "2026-01-15T14:00:00.000Z",
    );
  });

  it("spring-forward day (2026-03-08): pre-transition 1:30am EST → 06:30Z", () => {
    expect(etWallClockToUtcIso("2026-03-08", 1, 30)).toBe(
      "2026-03-08T06:30:00.000Z",
    );
  });

  it("spring-forward day (2026-03-08): post-transition 9:00am EDT → 13:00Z", () => {
    expect(etWallClockToUtcIso("2026-03-08", 9, 0)).toBe(
      "2026-03-08T13:00:00.000Z",
    );
  });

  it("fall-back day (2026-11-01): 9:00am EST → 14:00Z", () => {
    expect(etWallClockToUtcIso("2026-11-01", 9, 0)).toBe(
      "2026-11-01T14:00:00.000Z",
    );
  });
});

describe("day bucketing across the ET midnight boundary", () => {
  it("11:30pm ET buckets to that ET day, not the next (UTC) day", () => {
    // 2026-07-16T03:30Z is 2026-07-15 23:30 ET (EDT -4).
    const instant = new Date("2026-07-16T03:30:00Z");
    expect(etDayKey(instant)).toBe("2026-07-15");
    const { hour, minute } = etTimeParts(instant);
    expect(hour).toBe(23);
    expect(minute).toBe(30);
  });

  it("round-trips an arbitrary instant through day/time and back", () => {
    const instant = new Date("2026-03-20T22:30:00.000Z");
    const key = etDayKey(instant);
    const { hour, minute } = etTimeParts(instant);
    expect(etWallClockToUtcIso(key, hour, minute)).toBe(instant.toISOString());
  });
});

describe("civil date math on day keys", () => {
  it("weekKeys returns 7 Sunday-started keys containing the anchor", () => {
    const keys = weekKeys("2026-07-22"); // a Wednesday
    expect(keys).toHaveLength(7);
    expect(keyWeekday(keys[0])).toBe(0); // Sunday
    expect(keys).toContain("2026-07-22");
    expect(startOfWeekKey("2026-07-22")).toBe(keys[0]);
  });

  it("addDaysToKey crosses month boundaries", () => {
    expect(addDaysToKey("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDaysToKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("addMonthsToKey lands on the 1st, crossing years", () => {
    expect(addMonthsToKey("2026-07-22", 1)).toBe("2026-08-01");
    expect(addMonthsToKey("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("monthGridKeys is 42 Sunday-started keys covering the month", () => {
    const grid = monthGridKeys("2026-07-22");
    expect(grid).toHaveLength(42);
    expect(keyWeekday(grid[0])).toBe(0);
    expect(grid).toContain("2026-07-01");
    expect(grid).toContain("2026-07-31");
  });
});
