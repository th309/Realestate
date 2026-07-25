/**
 * America/New_York timezone helpers for the planner.
 *
 * Posts store scheduled_at as a UTC instant (timestamptz). The planner shows
 * and edits them in Eastern Time, so every "which day / what time" decision
 * goes through here. We use native Intl (no date-fns-tz dependency) for the
 * UTC<->ET boundary, and plain UTC-noon arithmetic for civil (date-only) math
 * so day stepping never drifts across a DST change.
 *
 * A "day key" is an ET calendar date as `YYYY-MM-DD`.
 */

export const PLANNER_TZ = "America/New_York";

const KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: PLANNER_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: PLANNER_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const PARTS_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: PLANNER_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** ET calendar date of an instant, as `YYYY-MM-DD`. */
export function etDayKey(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return KEY_FMT.format(d);
}

/** ET clock time of an instant, e.g. `9:05 AM`. */
export function formatEtTime(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return TIME_FMT.format(d);
}

/** ET hour (0-23) and minute of an instant. */
export function etTimeParts(instant: Date | string): {
  hour: number;
  minute: number;
} {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const parts = PARTS_FMT.formatToParts(d);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? "0");
  // h23 renders midnight as "24"; normalize to 0.
  const hour = get("hour") % 24;
  return { hour, minute: get("minute") };
}

/** ET offset from UTC in minutes at a given instant (EDT -240, EST -300). */
function etOffsetMinutes(instant: Date): number {
  const parts = PARTS_FMT.formatToParts(instant);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * Convert an ET wall-clock (day key + hour/minute) to the matching UTC instant,
 * as an ISO8601 string. Two-pass so instants near a DST change resolve to the
 * correct offset.
 */
export function etWallClockToUtcIso(
  dayKey: string,
  hour: number,
  minute: number,
): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const off1 = etOffsetMinutes(new Date(guess));
  const off2 = etOffsetMinutes(new Date(guess - off1 * 60000));
  return new Date(guess - off2 * 60000).toISOString();
}

// ── Civil (date-only) math on day keys ──────────────────────────────────────
// Anchored at 12:00 UTC so ±day stepping never lands on a DST-shifted boundary.

function keyToNoonUtc(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00Z`);
}

function noonUtcToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's ET day key. */
export function etTodayKey(): string {
  return etDayKey(new Date());
}

/** Day of week for a key, 0 = Sunday … 6 = Saturday. */
export function keyWeekday(dayKey: string): number {
  return keyToNoonUtc(dayKey).getUTCDay();
}

/** Add (or subtract) whole days to a key. */
export function addDaysToKey(dayKey: string, days: number): string {
  const d = keyToNoonUtc(dayKey);
  d.setUTCDate(d.getUTCDate() + days);
  return noonUtcToKey(d);
}

/** Add (or subtract) whole months to a key, landing on the 1st of the month. */
export function addMonthsToKey(dayKey: string, months: number): string {
  const [y, m] = dayKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  return noonUtcToKey(d);
}

/** The Sunday that starts the week containing `dayKey`. */
export function startOfWeekKey(dayKey: string): string {
  return addDaysToKey(dayKey, -keyWeekday(dayKey));
}

/** Seven day keys, Sunday…Saturday, for the week containing `dayKey`. */
export function weekKeys(dayKey: string): string[] {
  const start = startOfWeekKey(dayKey);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i));
}

/**
 * 42 day keys (6 rows × 7 cols) covering the month grid that contains
 * `dayKey`, starting on the Sunday on/before the 1st.
 */
export function monthGridKeys(dayKey: string): string[] {
  const firstOfMonth = `${dayKey.slice(0, 7)}-01`;
  const gridStart = startOfWeekKey(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDaysToKey(gridStart, i));
}

/** Whether a key falls in the same calendar month as `anchorKey`. */
export function sameMonth(dayKey: string, anchorKey: string): boolean {
  return dayKey.slice(0, 7) === anchorKey.slice(0, 7);
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Short weekday label for a key, e.g. `Mon`. */
export function weekdayShort(dayKey: string): string {
  return WEEKDAY_SHORT[keyWeekday(dayKey)];
}

/** Day-of-month number for a key, e.g. `7`. */
export function dayOfMonth(dayKey: string): number {
  return Number(dayKey.slice(8, 10));
}

/** Human label for the week range, e.g. `Jul 20 – 26, 2026`. */
export function weekRangeLabel(dayKey: string): string {
  const keys = weekKeys(dayKey);
  const first = keys[0];
  const last = keys[6];
  const y = last.slice(0, 4);
  const m1 = MONTH_LONG[Number(first.slice(5, 7)) - 1].slice(0, 3);
  const m2 = MONTH_LONG[Number(last.slice(5, 7)) - 1].slice(0, 3);
  const d1 = dayOfMonth(first);
  const d2 = dayOfMonth(last);
  return m1 === m2
    ? `${m1} ${d1} – ${d2}, ${y}`
    : `${m1} ${d1} – ${m2} ${d2}, ${y}`;
}

/** Human label for the month, e.g. `July 2026`. */
export function monthLabel(dayKey: string): string {
  return `${MONTH_LONG[Number(dayKey.slice(5, 7)) - 1]} ${dayKey.slice(0, 4)}`;
}
