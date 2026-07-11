/**
 * MARKET ERA ANNOTATIONS
 *
 * Curated, editorial timeline context for the Market Momentum Map: crashes,
 * rate moves, and booms shown as scrubber tick marks + a live caption.
 * Edit freely — widget logic never needs to change. Periods are inclusive
 * "YYYY-MM" bounds; keep them non-overlapping and chronological (unit-tested).
 */

export interface MarketEra {
  /** Inclusive start, "YYYY-MM" */
  from: string;
  /** Inclusive end, "YYYY-MM"; null = present */
  to: string | null;
  /** Short label for scrubber ticks */
  label: string;
  /** One-line caption shown beside the month readout */
  caption: string;
}

export const MARKET_ERAS: MarketEra[] = [
  {
    from: "2001-03",
    to: "2001-11",
    label: "Dot-com recession",
    caption: "Dot-com bust tips the economy into recession",
  },
  {
    from: "2004-01",
    to: "2006-06",
    label: "Housing boom peak",
    caption: "Subprime-fueled housing boom nears its peak",
  },
  {
    from: "2007-12",
    to: "2009-06",
    label: "Global financial crisis",
    caption: "Global financial crisis — home prices fall nationwide",
  },
  {
    from: "2012-01",
    to: "2012-12",
    label: "Recovery begins",
    caption: "Market bottoms out and the recovery begins",
  },
  {
    from: "2020-03",
    to: "2020-05",
    label: "COVID shock",
    caption: "COVID hits — the Fed cuts rates to zero",
  },
  {
    from: "2020-06",
    to: "2022-02",
    label: "Pandemic frenzy",
    caption: "Pandemic housing frenzy — record-low rates, bidding wars",
  },
  {
    from: "2022-03",
    to: "2023-07",
    label: "Fed hiking cycle",
    caption: "Fastest Fed rate-hiking cycle in 40 years cools demand",
  },
  {
    from: "2024-01",
    to: null,
    label: "High-rate cooldown",
    caption: "Markets adjust to a high-rate environment",
  },
];

/** Look up the era containing an ISO month ("YYYY-MM-DD" or "YYYY-MM"). */
export function eraForMonth(monthIso: string): MarketEra | null {
  const ym = monthIso.slice(0, 7);
  return (
    MARKET_ERAS.find(
      (era) => ym >= era.from && (era.to === null || ym <= era.to),
    ) ?? null
  );
}

/**
 * Scrubber tick positions: the first frame index inside each era. When a
 * truncated months array makes several eras resolve to the same index (all
 * their starts precede the first month), keep only the latest era's label —
 * a single collapsed tick beats several stacked, indistinguishable ones.
 */
export function eraTickIndices(
  months: string[],
): { index: number; label: string }[] {
  const byIndex = new Map<number, string>();
  for (const era of MARKET_ERAS) {
    const index = months.findIndex((m) => m.slice(0, 7) >= era.from);
    if (index >= 0) byIndex.set(index, era.label);
  }
  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, label]) => ({ index, label }));
}
