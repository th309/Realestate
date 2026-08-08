/**
 * 60 days clears two monthly PIQ rescores, so when the notice fires
 * something has almost certainly moved. Tighter than this and the banner
 * cries wolf; looser and a genuinely stale deal reads as current.
 */
export const STALE_AFTER_DAYS = 60;

/**
 * Above this age, "stale" stops being informative and starts being absurd.
 * `migrateDealState` (`./migrate-snapshot.ts`) defaults `marketCapturedAt`
 * to epoch 1970 for a legacy row with no `updated_at` — a value this old is
 * far more likely to be that missing-timestamp sentinel than a genuine
 * decade-old capture, so it's treated the same as an unparseable timestamp:
 * "I don't know when this was captured" must render as no banner, never as
 * a ~20,000-day one. The two files must keep agreeing on this.
 */
const MAX_PLAUSIBLE_AGE_DAYS = 365 * 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How old is this deal's MARKET data?
 *
 * Clocked off `DealStateV2.marketCapturedAt`, never `updated_at` — autosave
 * writes `updated_at` on every edit, so a notice keyed off it would be
 * silently disarmed the first time the user touched a 74-day-old deal.
 *
 * An unparseable timestamp, or one implausibly far in the past (see
 * `MAX_PLAUSIBLE_AGE_DAYS`), reports not-stale: a missing banner is a far
 * smaller failure than a crash on open, or an absurd one that trains users
 * to ignore the accurate ones.
 *
 * `marketCapturedAt` is typed to allow null/undefined even though every
 * current caller (`StaleDealNotice`) already guards before calling: `new
 * Date(null)` evaluates to epoch 1970, NOT `NaN`, so a null slipping through
 * untyped would silently report `stale: true` with a ~20,000-day count
 * instead of degrading safely like every other bad input here.
 */
export function getDealStaleness(
  marketCapturedAt: string | null | undefined,
  now: Date = new Date(),
): { stale: boolean; days: number } {
  if (!marketCapturedAt) return { stale: false, days: 0 };
  const captured = new Date(marketCapturedAt).getTime();
  if (!Number.isFinite(captured)) return { stale: false, days: 0 };

  const days = Math.floor((now.getTime() - captured) / MS_PER_DAY);
  if (days <= 0) return { stale: false, days: 0 };
  if (days > MAX_PLAUSIBLE_AGE_DAYS) return { stale: false, days: 0 };
  return { stale: days > STALE_AFTER_DAYS, days };
}
