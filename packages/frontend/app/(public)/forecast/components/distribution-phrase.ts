import type { ScoreDistributionBucket } from "@/lib/data";

/**
 * Momentum-label groupings for the /forecast hub's distribution summary.
 * Sourced from getScoreLabel's 8-value vocabulary (CLAUDE.md §9) — these three
 * sets exactly partition it. Exported so both DistributionSummary and the hub
 * FAQ builder (and the lock test) share one definition instead of duplicating
 * the label lists.
 */
export const RISING_LABELS = ["VERY STRONG", "STRONG", "RISING", "FIRMING"];
export const STEADY_LABELS = ["STEADY"];
export const EASING_LABELS = ["EASING", "WEAK", "VERY WEAK"];

function countLabels(
  buckets: ScoreDistributionBucket[],
  labels: string[],
): number {
  return buckets
    .filter((b) => labels.includes(b.label))
    .reduce((sum, b) => sum + b.count, 0);
}

/**
 * Momentum-descriptive characterization of the live score distribution —
 * derived from the same rising/steady/easing counts the hub already computes,
 * never a fixed conclusion. Must stay momentum-descriptive; never reintroduce
 * a crash prediction (CLAUDE.md §9 — labels are timing signals, not verdicts).
 */
export function distributionPhrase(
  buckets: ScoreDistributionBucket[],
  total: number,
): string {
  if (total <= 0) return "a market moving unevenly, not in one direction";

  const easing = countLabels(buckets, EASING_LABELS);
  const rising = countLabels(buckets, RISING_LABELS);

  if (easing / total > 0.6) return "a market where cooling is widespread";
  if (rising / total > 0.6) return "a market where demand is broadly firming";
  return "a market moving unevenly, not in one direction";
}
