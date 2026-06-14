/**
 * Orchestrator for the read-only analyzer view (share page + PDF source).
 *
 * Pulls the rich snapshot saved by the analyzer at Share-click time and
 * routes the right pieces into the cover page + analytics page. Tolerates
 * older "minimal" snapshots (only rental/flip/brrrr + market_context) by
 * falling back to placeholders / hiding sections that need richer data.
 *
 * The full snapshot shape we expect from new saves lives in
 * `lib/analyzer-snapshot-types.ts` (single source of truth).
 */

import type { SavedAnalysis } from "@/lib/data/fetchers/analyzer";
import type { SharedAnalysisBranding } from "@/lib/data/fetchers/analyzer-share";
import type { RichResultSnapshot } from "@/app/analyzer/lib/analyzer-snapshot-types";
import { ReadonlyCoverPage } from "./ReadonlyCoverPage";
import { ReadonlyAnalyticsPage } from "./ReadonlyAnalyticsPage";

interface Props {
  row: SavedAnalysis;
  branding: SharedAnalysisBranding | null;
}

export function ReadonlyAnalyzerView({ row, branding }: Props) {
  const snap = (row.result_snapshot ?? {}) as Partial<RichResultSnapshot>;
  const rental = snap.rental ?? {};
  const flip = snap.rental ? (snap.flip ?? null) : null;
  const brrrr = snap.brrrr ?? null;

  const grading = snap.grading ?? null;
  const gradeLetter: "A" | "B" | "C" | "D" | "F" =
    (grading?.letter as "A" | "B" | "C" | "D" | "F") ?? "C";
  const gradeQualifier = grading?.label ?? undefined;

  const ai = snap.aiNarratives ?? {};
  const verdictNarrative = ai.recommendation_analysis ?? null;
  // Prefer market-context AI prose; fall back to comps prose; never duplicate
  // the verdict narrative (it already drop-caps the cover page).
  const marketCommentary = ai.market_context ?? ai.comps ?? null;

  const bestStrategy =
    (snap.bestStrategy as "buyAndHold" | "flip" | "brrrr" | undefined) ??
    inferBestStrategy(rental, flip, brrrr);

  const preparedDate = (row.created_at ?? "").slice(0, 10) || "—";
  const disclaimer =
    branding?.report_disclaimer ??
    "This is not investment advice. PropertyIQ projections are estimates based on current market data and assumptions; actual results will vary.";

  return (
    <>
      <ReadonlyCoverPage
        preparedDate={preparedDate}
        addressFull={row.address_full ?? null}
        addressCity={row.address_city ?? null}
        addressState={row.address_state ?? null}
        addressZip={row.address_zip ?? null}
        gradeLetter={gradeLetter}
        gradeQualifier={gradeQualifier}
        verdictNarrative={verdictNarrative}
        rental={rental}
        flip={flip}
        brrrr={brrrr}
        bestStrategy={bestStrategy}
        strategyNarrative={null}
        input={
          snap.input ?? (row.input_snapshot as Record<string, unknown>) ?? {}
        }
        assumptions={snap.assumptions}
        arvLocal={snap.arvLocal ?? null}
        rehabBudget={snap.rehabBudget ?? null}
        propertyClass={snap.propertyClass ?? null}
        expense={snap.expense}
      />

      <ReadonlyAnalyticsPage
        input={
          snap.input ?? (row.input_snapshot as Record<string, unknown>) ?? null
        }
        rental={rental}
        flip={flip}
        brrrr={brrrr}
        projection={snap.projection ?? null}
        afterTax={snap.afterTax ?? null}
        sensitivity={snap.sensitivity ?? null}
        expense={snap.expense ?? null}
        marketContext={row.market_context ?? snap.marketContext ?? null}
        arvLocal={snap.arvLocal ?? null}
        rehabBudget={snap.rehabBudget ?? null}
        activeStrategy={bestStrategy}
        marginalTaxRate={
          (snap.assumptions as { marginalTaxRate?: number })?.marginalTaxRate ??
          null
        }
        salesComps={snap.comps?.salesComps ?? []}
        aiNarratives={ai}
        disclaimer={disclaimer}
      />
    </>
  );
}

function inferBestStrategy(
  rental: Partial<{ capRatePct?: number | null }>,
  flip: { projectedRoiPct?: number | null } | null,
  brrrr: { score?: number | null } | null,
): "buyAndHold" | "flip" | "brrrr" {
  if (brrrr?.score != null && brrrr.score >= 7) return "brrrr";
  if (flip?.projectedRoiPct != null && flip.projectedRoiPct >= 15)
    return "flip";
  return "buyAndHold";
}
