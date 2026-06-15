import type { ScreenerQuery } from "@/lib/data";
import { formatMetricValue } from "@/lib/data";

/**
 * Human-readable summary of the currently-active screener constraints.
 *
 * Used by the table's empty state so a "No markets match" result reads as
 * "your filters are narrow" rather than "the page is broken" — e.g. the
 * "Undervalued + High Score" preset applies PIQ Score ≥ 70, which legitimately
 * empties small states. Labels mirror FilterRail so the wording is consistent.
 */
export function summarizeScreenerFilters(
  filters: Partial<ScreenerQuery>,
  stateFilter: string,
): string[] {
  const out: string[] = [];

  if (stateFilter) out.push(`State: ${stateFilter}`);

  const range = (
    label: string,
    min: number | undefined,
    max: number | undefined,
    fmt: (n: number) => string,
  ) => {
    if (min !== undefined && max !== undefined) {
      out.push(`${label} ${fmt(min)}–${fmt(max)}`);
    } else if (min !== undefined) {
      out.push(`${label} ≥ ${fmt(min)}`);
    } else if (max !== undefined) {
      out.push(`${label} ≤ ${fmt(max)}`);
    }
  };

  const num = (n: number) => String(n);
  const pct = (n: number) => `${n}%`;
  const money = (n: number) => formatMetricValue(n, "currency");

  range("PIQ Score", filters.scoreMin, filters.scoreMax, num);
  range("Median Price", filters.medianPriceMin, filters.medianPriceMax, money);
  range("Cap Rate", filters.capRateMin, filters.capRateMax, pct);
  range(
    "Months of Supply",
    filters.monthsOfSupplyMin,
    filters.monthsOfSupplyMax,
    num,
  );
  range("Overvalued", filters.overvaluedMin, filters.overvaluedMax, pct);

  return out;
}
