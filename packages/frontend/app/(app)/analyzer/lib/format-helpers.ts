/**
 * Tiny presentation helpers shared across AnalyzerClient + section composers.
 * Kept outside `@/lib/data/format` because these are analyzer-redesign-specific
 * formatting choices (e.g. "—" sentinel for null instead of "$0").
 */

export const fmtPct = (v: number | null): string =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;

export const fmtUsd = (v: number | null): string => {
  if (v == null) return "—";
  const abs = Math.round(Math.abs(v)).toLocaleString();
  return v < 0 ? `-$${abs}` : `$${abs}`;
};

export const fmtRatio = (v: number | null): string =>
  v == null ? "—" : v.toFixed(2);

/**
 * Five-point deal verdict. Letters map 1:1 to actions:
 *   A → Great Deal, B → Good Deal, C → Marginal, D → Bad Deal, F → Avoid
 */
export type Verdict = "great" | "good" | "marginal" | "bad" | "avoid";

const VERDICT_ORDER: Verdict[] = ["avoid", "bad", "marginal", "good", "great"];

export const VERDICT_LETTER: Record<Verdict, string> = {
  great: "A",
  good: "B",
  marginal: "C",
  bad: "D",
  avoid: "F",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  great: "Great Deal",
  good: "Good Deal",
  marginal: "Marginal",
  bad: "Bad Deal",
  avoid: "Avoid",
};

export function verdictColor(verdict: Verdict): string {
  // 5-hue piq palette: green / teal / amber / orange / red for A / B / C / D / F.
  // Resolves to --piq-* CSS variables defined at :root in app/globals.css.
  switch (verdict) {
    case "great":
      return "var(--piq-green)";
    case "good":
      return "var(--piq-teal)";
    case "marginal":
      return "var(--piq-amber)";
    case "bad":
      return "var(--piq-orange)";
    case "avoid":
      return "var(--piq-red)";
  }
}

/** Map the 5-tier Verdict to a DealGrade letter (no +/- modifiers in v1). */
export function verdictToGradeLetter(
  verdict: Verdict,
): "A" | "B" | "C" | "D" | "F" {
  switch (verdict) {
    case "great":
      return "A";
    case "good":
      return "B";
    case "marginal":
      return "C";
    case "bad":
      return "D";
    case "avoid":
      return "F";
  }
}

/** Short qualifier shown under the letter in DealGrade. */
export function verdictToQualifier(verdict: Verdict): string {
  switch (verdict) {
    case "great":
      return "Strong cash flow";
    case "good":
      return "Solid hold";
    case "marginal":
      return "Marginal";
    case "bad":
      return "Tight margins";
    case "avoid":
      return "Walk away";
  }
}

export interface SavedAnalysisLabelFields {
  label: string | null;
  address_full: string | null;
  address_city: string | null;
  address_state: string | null;
}

/**
 * Blank-safe display label for a saved analysis (list row or page title).
 * A property can legitimately save with only a partial address resolved
 * (address_full present but city/state empty, or vice versa) — guard
 * against rendering a bare ", " in that case and fall back to a friendly
 * default when every field is blank.
 */
export function resolveSavedAnalysisLabel(
  row: SavedAnalysisLabelFields,
): string {
  const cityState = [row.address_city, row.address_state]
    .filter(Boolean)
    .join(", ");
  return row.label || row.address_full || cityState || "Untitled analysis";
}

export interface VerdictInputs {
  capRatePct: number | null; // e.g. 7.5 means 7.5%
  dscr: number | null; // debt service coverage
  cashflowMonthly: number | null; // dollars / month after debt service
  piqScore: number | null; // 1-99, 50 = state avg
}

/**
 * Aggressive thresholds (user-chosen 2026-05-15):
 *   GREAT:    cap ≥ 8.0%, DSCR ≥ 1.3, cashflow > 0
 *   GOOD:     cap 6.5–7.9%, DSCR ≥ 1.2
 *   MARGINAL: cap 5.0–6.4%, DSCR ≥ 1.0
 *   BAD:      cap 3.5–4.9%
 *   AVOID:    cap < 3.5% OR DSCR < 1.0
 *
 * Market adjustment: PIQ < 35 (weak market) demotes one tier (floor: avoid).
 */
export function deriveVerdict(inputs: VerdictInputs): Verdict {
  const { capRatePct, dscr, cashflowMonthly, piqScore } = inputs;

  if (capRatePct == null) return "marginal";
  if (capRatePct < 3.5 || (dscr != null && dscr < 1.0)) return "avoid";

  let tier: Verdict;
  if (
    capRatePct >= 8.0 &&
    (dscr == null || dscr >= 1.3) &&
    (cashflowMonthly == null || cashflowMonthly > 0)
  ) {
    tier = "great";
  } else if (capRatePct >= 6.5 && (dscr == null || dscr >= 1.2)) {
    tier = "good";
  } else if (capRatePct >= 5.0 && (dscr == null || dscr >= 1.0)) {
    tier = "marginal";
  } else {
    tier = "bad";
  }

  if (piqScore != null && piqScore < 35) {
    const idx = VERDICT_ORDER.indexOf(tier);
    tier = VERDICT_ORDER[Math.max(0, idx - 1)];
  }

  return tier;
}
