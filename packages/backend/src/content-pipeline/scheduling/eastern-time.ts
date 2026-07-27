// packages/backend/src/content-pipeline/scheduling/eastern-time.ts
//
// America/New_York helpers for the auto-scheduler.
//
// These MUST stay behaviorally identical to the planner's frontend copy at
// packages/frontend/app/(app)/admin/content-pipeline/planner/planner-tz.ts. The
// calendar renders scheduled_at through those helpers; if the backend picked
// slots with different ET math, an auto-scheduled post would land on a
// different day/time than the operator sees. Same algorithm, no shared package:
// native Intl for the UTC<->ET boundary, UTC-noon anchoring for civil day math
// so day stepping never drifts across a DST change.
//
// A "day key" is an ET calendar date as `YYYY-MM-DD`.

export const SCHEDULER_TZ = 'America/New_York';

const KEY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHEDULER_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const PARTS_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: SCHEDULER_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** ET calendar date of an instant, as `YYYY-MM-DD`. */
export function etDayKey(instant: Date | string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  return KEY_FMT.format(d);
}

/** ET hour (0-23) and minute of an instant. */
export function etTimeParts(instant: Date | string): {
  hour: number;
  minute: number;
} {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  const parts = PARTS_FMT.formatToParts(d);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? '0');
  // h23 renders midnight as "24"; normalize to 0.
  return { hour: get('hour') % 24, minute: get('minute') };
}

/** Minutes since ET midnight for an instant (0-1439). */
export function etMinutesOfDay(instant: Date | string): number {
  const { hour, minute } = etTimeParts(instant);
  return hour * 60 + minute;
}

/** ET offset from UTC in minutes at a given instant (EDT -240, EST -300). */
function etOffsetMinutes(instant: Date): number {
  const parts = PARTS_FMT.formatToParts(instant);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * Convert an ET wall-clock (day key + hour/minute) to the matching UTC instant,
 * as an ISO8601 string. Two-pass so instants near a DST change resolve to the
 * correct offset.
 *
 * A wall clock inside the spring-forward gap (e.g. 2:30 AM on the second Sunday
 * in March) does not exist; this returns a nearby real instant rather than
 * throwing. Callers that care MUST verify the round trip — see
 * `etWallClockExists`.
 *
 * The fall-back repeated hour (1:00-1:59 AM on the first Sunday in November)
 * is the opposite problem: that wall clock is real but happens TWICE. This
 * function has no way to know which occurrence is meant, so by convention it
 * always resolves to the FIRST (pre-transition, EDT/UTC-4) occurrence. There is
 * deliberately no skip guard for this case the way there is for the spring
 * gap: refusing to place a post in that hour would silently drop it from the
 * day entirely, which is worse than publishing an hour off from intent. This
 * is the same convention the frontend's planner-tz.ts uses (unguarded, same
 * two-pass algorithm), so the calendar and the scheduler always agree with
 * each other even though neither resolves the ambiguity "correctly".
 */
export function etWallClockToUtcIso(
  dayKey: string,
  hour: number,
  minute: number,
): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const off1 = etOffsetMinutes(new Date(guess));
  const off2 = etOffsetMinutes(new Date(guess - off1 * 60000));
  return new Date(guess - off2 * 60000).toISOString();
}

/**
 * Whether an ET wall clock actually exists on that day. False for times inside
 * the spring-forward gap, which have no real instant: the scheduler skips those
 * slots rather than silently shifting a post to a different clock time.
 */
export function etWallClockExists(
  dayKey: string,
  hour: number,
  minute: number,
): boolean {
  const iso = etWallClockToUtcIso(dayKey, hour, minute);
  const parts = etTimeParts(iso);
  return (
    etDayKey(iso) === dayKey && parts.hour === hour && parts.minute === minute
  );
}

// ── Civil (date-only) math on day keys ──────────────────────────────────────
// Anchored at 12:00 UTC so ±day stepping never lands on a DST-shifted boundary.

function keyToNoonUtc(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00Z`);
}

/** Day of week for a key, 0 = Sunday … 6 = Saturday. */
export function keyWeekday(dayKey: string): number {
  return keyToNoonUtc(dayKey).getUTCDay();
}

/** Add (or subtract) whole days to a key. */
export function addDaysToKey(dayKey: string, days: number): string {
  const d = keyToNoonUtc(dayKey);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Sunday that starts the week containing `dayKey`. */
export function startOfWeekKey(dayKey: string): string {
  return addDaysToKey(dayKey, -keyWeekday(dayKey));
}
