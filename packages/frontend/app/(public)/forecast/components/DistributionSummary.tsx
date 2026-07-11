import type { ScoreDistributionData } from "@/lib/data";

interface DistributionSummaryProps {
  distribution: ScoreDistributionData;
  year: number;
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Deterministic, data-derived answer to the crash question: the live momentum
 * distribution across all scored metros. No AI, no speculation.
 */
export function DistributionSummary({
  distribution,
  year,
}: DistributionSummaryProps) {
  const { buckets, total } = distribution;
  const count = (labels: string[]) =>
    buckets
      .filter((b) => labels.includes(b.label))
      .reduce((s, b) => s + b.count, 0);

  const rising = count(["VERY STRONG", "STRONG", "RISING", "FIRMING"]);
  const steady = count(["STEADY"]);
  const easing = count(["EASING", "WEAK", "VERY WEAK"]);

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <p className="text-lg text-on-surface leading-relaxed">
        Across {total.toLocaleString()} scored metro markets,{" "}
        {pct(easing, total)}% show easing or weak demand momentum heading into{" "}
        {year}, {pct(steady, total)}% are steady near their state average, and{" "}
        {pct(rising, total)}% are firming or rising. That is a market that is
        cooling unevenly — not a nationwide crash.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-outline-variant p-5">
          <div className="text-2xl font-medium font-mono text-on-surface">
            {pct(rising, total)}%
          </div>
          <div className="text-sm text-on-surface-variant mt-1">
            Firming or rising momentum
          </div>
        </div>
        <div className="rounded-xl border border-outline-variant p-5">
          <div className="text-2xl font-medium font-mono text-on-surface">
            {pct(steady, total)}%
          </div>
          <div className="text-sm text-on-surface-variant mt-1">
            Steady, near state average
          </div>
        </div>
        <div className="rounded-xl border border-outline-variant p-5">
          <div className="text-2xl font-medium font-mono text-on-surface">
            {pct(easing, total)}%
          </div>
          <div className="text-sm text-on-surface-variant mt-1">
            Easing or weak momentum
          </div>
        </div>
      </div>
    </section>
  );
}
