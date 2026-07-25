/**
 * The three headline insight cards — Reach, Engagement, Net followers — each a
 * big current-30d number with a delta-vs-prior badge. This is the page's thesis:
 * "how's my content trending this month?"
 */
import type { InsightsTotals } from "../lib/insights-api";
import { DeltaBadge } from "./DeltaBadge";
import { formatCompactNumber, formatSignedCompact } from "./insights-format";

export function HeadlineCards({
  totals,
  priorTotals,
}: {
  totals: InsightsTotals;
  priorTotals: InsightsTotals;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <HeadlineCard
        label="Reach"
        value={formatCompactNumber(totals.reach)}
        current={totals.reach}
        prior={priorTotals.reach}
      />
      <HeadlineCard
        label="Engagement"
        value={formatCompactNumber(totals.engagement)}
        current={totals.engagement}
        prior={priorTotals.engagement}
      />
      <HeadlineCard
        label="Net followers"
        value={formatSignedCompact(totals.followersDelta)}
        current={totals.followersDelta}
        prior={priorTotals.followersDelta}
      />
    </div>
  );
}

function HeadlineCard({
  label,
  value,
  current,
  prior,
}: {
  label: string;
  value: string;
  current: number;
  prior: number;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold tabular-nums text-on-surface">
          {value}
        </span>
        <DeltaBadge current={current} prior={prior} />
      </div>
      <div className="mt-1 text-xs text-on-surface-variant">
        last 30 days vs prior 30
      </div>
    </div>
  );
}
