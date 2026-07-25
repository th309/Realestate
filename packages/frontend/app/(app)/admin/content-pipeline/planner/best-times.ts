/**
 * Best-time auto-slotting heuristic (Eastern Time).
 *
 * When an approved (unscheduled) post is dropped onto a day, we pick a good
 * posting slot for it rather than a raw midnight. The heuristic favors a small
 * set of high-engagement windows and skips any that already has a post that
 * day, so auto-slotting spreads posts out instead of stacking them.
 *
 * This is intentionally simple and static — a placeholder for a future
 * per-platform, engagement-derived model.
 */

export interface DaySlot {
  hour: number;
  minute: number;
  label: string;
}

/** Preferred posting windows, in priority order (ET). */
export const BEST_TIME_SLOTS_ET: DaySlot[] = [
  { hour: 9, minute: 0, label: "9:00 AM" },
  { hour: 12, minute: 0, label: "12:00 PM" },
  { hour: 17, minute: 0, label: "5:00 PM" },
  { hour: 19, minute: 30, label: "7:30 PM" },
];

const MIN_GAP_MINUTES = 45;

/**
 * Pick a slot for a new post on a day, avoiding times within MIN_GAP_MINUTES of
 * an already-scheduled post. `occupiedMinutes` is minutes-since-ET-midnight for
 * posts already on that day. Falls back to hourly stepping, then 9:00 AM.
 */
export function bestTimeForDay(occupiedMinutes: number[]): DaySlot {
  const isFree = (mins: number) =>
    !occupiedMinutes.some((o) => Math.abs(o - mins) < MIN_GAP_MINUTES);

  for (const slot of BEST_TIME_SLOTS_ET) {
    if (isFree(slot.hour * 60 + slot.minute)) return slot;
  }
  for (let hour = 8; hour <= 21; hour++) {
    if (isFree(hour * 60)) {
      return { hour, minute: 0, label: labelFor(hour, 0) };
    }
  }
  return { hour: 9, minute: 0, label: "9:00 AM" };
}

function labelFor(hour: number, minute: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${period}`;
}
