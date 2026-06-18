// Score-movers shared config + presentation helpers. Flat green/red threshold:
// gains green, losses red, zero/missing neutral — NO magnitude grading.
import type { MoverWindow, ScreenerQuery } from "@/lib/data";

type SortBy = NonNullable<ScreenerQuery["sortBy"]>;

export const MOVER_WINDOWS: MoverWindow[] = [
  "1m",
  "3m",
  "6m",
  "1y",
  "3y",
  "5y",
];

export const DEFAULT_WINDOW: MoverWindow = "3m";

export const WINDOW_META: Record<
  MoverWindow,
  { label: string; tooltip: string }
> = {
  "1m": { label: "1M", tooltip: "Score change over the last month" },
  "3m": { label: "3M", tooltip: "Score change over ~90 days" },
  "6m": { label: "6M", tooltip: "Score change over ~180 days" },
  "1y": { label: "1Y", tooltip: "Score change over 1 year" },
  "3y": { label: "3Y", tooltip: "Score change over 3 years" },
  "5y": { label: "5Y", tooltip: "Score change over 5 years" },
};

export const WINDOW_TO_COLUMN: Record<MoverWindow, SortBy> = {
  "1m": "score_chg_1m",
  "3m": "score_chg_3m",
  "6m": "score_chg_6m",
  "1y": "score_chg_1y",
  "3y": "score_chg_3y",
  "5y": "score_chg_5y",
};

/** Flat threshold color class for a Δ value. */
export function getScoreChangeColor(delta: number | null): string {
  if (delta === null || delta === 0) return "text-on-surface-variant";
  return delta > 0 ? "text-tertiary" : "text-error";
}

/** Signed integer with a real minus sign (U+2212); em-dash for missing. */
export function formatScoreChange(delta: number | null): string {
  if (delta === null) return "—";
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}
