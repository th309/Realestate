/**
 * 60 days clears two monthly PIQ rescores, so when the notice fires
 * something has almost certainly moved. Tighter than this and the banner
 * cries wolf; looser and a genuinely stale deal reads as current.
 */
export const STALE_AFTER_DAYS = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How old is this deal's MARKET data?
 *
 * Clocked off `DealStateV2.marketCapturedAt`, never `updated_at` — autosave
 * writes `updated_at` on every edit, so a notice keyed off it would be
 * silently disarmed the first time the user touched a 74-day-old deal.
 *
 * An unparseable timestamp reports not-stale: a missing banner is a far
 * smaller failure than a crash on open.
 */
export function getDealStaleness(
  marketCapturedAt: string,
  now: Date = new Date(),
): { stale: boolean; days: number } {
  const captured = new Date(marketCapturedAt).getTime();
  if (!Number.isFinite(captured)) return { stale: false, days: 0 };

  const days = Math.floor((now.getTime() - captured) / MS_PER_DAY);
  if (days <= 0) return { stale: false, days: 0 };
  return { stale: days > STALE_AFTER_DAYS, days };
}
