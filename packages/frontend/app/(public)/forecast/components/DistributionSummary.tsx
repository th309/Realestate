import type { ScoreDistributionData } from "@/lib/data";
import {
  RISING_LABELS,
  STEADY_LABELS,
  EASING_LABELS,
  distributionPhrase,
} from "./distribution-phrase";

interface DistributionSummaryProps {
  distribution: ScoreDistributionData;
  year: number;
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Deterministic, data-derived answer to the crash question: the live momentum
 * distribution across all scored metros. No AI, no speculation. The closing
 * characterization is derived from the distribution itself (distributionPhrase)
 * rather than a fixed conclusion, so it can't contradict future data.
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

  const rising = count(RISING_LABELS);
  const steady = count(STEADY_LABELS);
  const easing = count(EASING_LABELS);
  const phrase = distributionPhrase(buckets, total);

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <p className="text-lg text-on-surface leading-relaxed">
        Across {total.toLocaleString()} scored metro markets,{" "}
        {pct(easing, total)}% show easing or weak demand momentum heading into{" "}
        {year}, {pct(steady, total)}% are steady near their state average, and{" "}
        {pct(rising, total)}% are firming or rising. That is {phrase}.
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
