"use client";

import { Clock, Loader2 } from "lucide-react";
import { getDealStaleness } from "../../lib/deal-staleness";

interface StaleDealNoticeProps {
  marketCapturedAt: string | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

/**
 * Offers a refresh when a reopened deal's market data has aged past
 * `STALE_AFTER_DAYS` (`getDealStaleness`, Task 4). Reports only the data's
 * AGE — it has not compared the old figures to anything new, so it must
 * not claim a direction.
 *
 * Momentum-neutral per CLAUDE.md section 9: a PropertyIQ Score move is
 * timing, never a quality verdict, so this can never read as "the market
 * got worse" or "got better", only that the numbers are old.
 *
 * Same amber caution tone as `PiqInsightStrip`'s `caution` variant, in the
 * full-banner shape of `AutoKillBanner` (icon, message, action) because
 * this one carries a button rather than sitting under a card as a footnote.
 */
export function StaleDealNotice({
  marketCapturedAt,
  onRefresh,
  isRefreshing,
}: StaleDealNoticeProps) {
  if (!marketCapturedAt) return null;
  const { stale, days } = getDealStaleness(marketCapturedAt);
  if (!stale) return null;

  return (
    <div
      data-stale-deal-notice
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-piq border border-piq-amber bg-piq-amber-soft px-[18px] py-4"
    >
      <Clock
        size={17}
        strokeWidth={2}
        aria-hidden
        className="flex-none text-piq-amber"
      />
      <p className="min-w-0 flex-1 text-[13.5px] text-piq-ink">
        This analysis is {days} days old. Market data may have changed since it
        was captured — the figures above still reflect what was true on the save
        date.
      </p>
      <button
        type="button"
        data-stale-deal-refresh
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-piq-indigo px-4 py-1.5 text-[12.5px] font-bold text-piq-on-indigo transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRefreshing && (
          <Loader2 size={13} aria-hidden className="animate-spin" />
        )}
        Update market data
      </button>
    </div>
  );
}
