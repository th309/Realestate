/**
 * Weekly recap for the studio home — a compact banner of the last 30 days'
 * reach / engagement / follower growth, each with a delta-vs-prior badge, and a
 * link into Insights. Self-fetches (shares the insights overview query cache)
 * and renders nothing while loading, on error, or when nothing has published —
 * the home stays quiet until there's something to recap.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchInsightsOverview } from "../../lib/insights-api";
import { DeltaBadge } from "../../insights/DeltaBadge";
import {
  formatCompactNumber,
  formatSignedCompact,
} from "../../insights/insights-format";

export function WeeklyRecapCard() {
  const { data, isSuccess } = useQuery({
    queryKey: ["cp-insights", "overview", 30],
    queryFn: () => fetchInsightsOverview(30),
    refetchInterval: 5 * 60_000,
  });

  // Hidden until there's a successful load with something published.
  if (!isSuccess || data.totals.posts === 0) return null;

  const { totals, priorTotals } = data;

  return (
    <section
      aria-labelledby="weekly-recap-heading"
      className="rounded-xl border border-outline-variant bg-surface-container-low p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="weekly-recap-heading"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
        >
          Last 30 days
        </h2>
        <Link
          href="/admin/content-pipeline/insights"
          className="rounded-full px-3 py-1 text-sm font-medium text-primary transition-colors duration-200 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          See insights
        </Link>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
        <RecapStat
          label="Reach"
          value={formatCompactNumber(totals.reach)}
          current={totals.reach}
          prior={priorTotals.reach}
        />
        <RecapStat
          label="Engagement"
          value={formatCompactNumber(totals.engagement)}
          current={totals.engagement}
          prior={priorTotals.engagement}
        />
        <RecapStat
          label="Net followers"
          value={formatSignedCompact(totals.followersDelta)}
          current={totals.followersDelta}
          prior={priorTotals.followersDelta}
        />
      </dl>
    </section>
  );
}

function RecapStat({
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
    <div>
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 flex items-baseline gap-2">
        <span className="font-mono text-xl font-bold tabular-nums text-on-surface">
          {value}
        </span>
        <DeltaBadge current={current} prior={prior} />
      </dd>
    </div>
  );
}
