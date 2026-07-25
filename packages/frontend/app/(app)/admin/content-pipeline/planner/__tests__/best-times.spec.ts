import { describe, it, expect } from "vitest";
import { bestTimeForDay, BEST_TIME_SLOTS_ET } from "../best-times";
import { etWallClockToUtcIso, etDayKey } from "../planner-tz";

describe("bestTimeForDay", () => {
  it("returns the first preferred slot (9:00 AM) on an empty day", () => {
    expect(bestTimeForDay([])).toEqual(BEST_TIME_SLOTS_ET[0]);
  });

  it("skips a preferred slot that is occupied", () => {
    // 9:00 AM = 540 minutes taken → next preferred slot is noon (720).
    const slot = bestTimeForDay([540]);
    expect(slot).not.toBeNull();
    expect(slot).toEqual(BEST_TIME_SLOTS_ET[1]);
  });

  it("returns null when the day is too full to place without a collision", () => {
    // Occupy every 30 minutes from 8:00am (480) to 9:00pm (1260): no candidate
    // slot can satisfy the 45-minute gap.
    const packed: number[] = [];
    for (let m = 480; m <= 1260; m += 30) packed.push(m);
    expect(bestTimeForDay(packed)).toBeNull();
  });
});

describe("composed path: bestTimeForDay → etWallClockToUtcIso (PATCH payload)", () => {
  it("produces a UTC instant that buckets back to the same ET day", () => {
    const dayKey = "2026-07-15";
    const slot = bestTimeForDay([]);
    expect(slot).not.toBeNull();
    const iso = etWallClockToUtcIso(dayKey, slot!.hour, slot!.minute);
    // 9:00 AM ET on 2026-07-15 (EDT -4) = 13:00Z, and re-buckets to the day.
    expect(iso).toBe("2026-07-15T13:00:00.000Z");
    expect(etDayKey(iso)).toBe(dayKey);
  });

  it("winter composed path lands in EST and stays on the day", () => {
    const dayKey = "2026-01-15";
    const slot = bestTimeForDay([]);
    const iso = etWallClockToUtcIso(dayKey, slot!.hour, slot!.minute);
    expect(iso).toBe("2026-01-15T14:00:00.000Z");
    expect(etDayKey(iso)).toBe(dayKey);
  });
});
