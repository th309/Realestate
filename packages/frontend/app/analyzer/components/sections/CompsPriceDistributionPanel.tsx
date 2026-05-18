"use client";

/**
 * Comp price-distribution column for the CompsSection.
 *
 * Renders one of three states based on what RentCast returned:
 *   1. PRIMARY  — at least 3 comps have sqft → price-per-sqft histogram
 *   2. FALLBACK — fewer than 3 comps have sqft but ≥3 have price → price
 *                 distribution histogram (same chart, different formatter)
 *   3. EMPTY    — neither chart can render → diagnostic empty state
 *
 * Always renders a one-line "comp count" banner so the user can see what
 * actually came back from RentCast (sqft is frequently null on
 * /avm/value comps).
 */
import { CompsDistribution } from "../primitives/CompsDistribution";
import type { Comp } from "../primitives/CompsDistribution";
import { piq } from "../primitives/piqTokens";

interface CompsPriceDistributionPanelProps {
  totalSalesComps: number;
  sqftCompCount: number;
  priceCompCount: number;
  distributionComps: Comp[];
  priceOnlyComps: Comp[];
  yourPricePerSqft: number;
  subjectPrice?: number;
  subjectAddress?: string | null;
  canRenderPrimary: boolean;
  canRenderFallback: boolean;
}

function formatPriceK(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(value / 1000)}K`;
}

export function CompsPriceDistributionPanel({
  totalSalesComps,
  sqftCompCount,
  priceCompCount,
  distributionComps,
  priceOnlyComps,
  yourPricePerSqft,
  subjectPrice,
  subjectAddress,
  canRenderPrimary,
  canRenderFallback,
}: CompsPriceDistributionPanelProps) {
  const title = canRenderPrimary
    ? "Price-per-sqft distribution"
    : canRenderFallback
      ? "Sale price distribution"
      : "Price distribution";

  return (
    <div data-comps-distribution>
      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
        <h4
          className="text-xs uppercase font-semibold"
          style={{ color: piq.textMuted, letterSpacing: "0.08em" }}
        >
          {title}
        </h4>
        <span
          data-comps-count-diagnostic
          className="text-[11px] tabular-nums"
          style={{ color: piq.textMuted }}
        >
          {totalSalesComps} comp{totalSalesComps === 1 ? "" : "s"} loaded ·{" "}
          {sqftCompCount} with sqft
        </span>
      </div>

      {canRenderPrimary ? (
        <CompsDistribution
          comps={distributionComps}
          subjectPricePerSqft={yourPricePerSqft}
          subjectAddress={subjectAddress ?? undefined}
        />
      ) : canRenderFallback && subjectPrice ? (
        <>
          <CompsDistribution
            comps={priceOnlyComps}
            subjectPricePerSqft={subjectPrice}
            subjectAddress={subjectAddress ?? undefined}
            formatValue={formatPriceK}
            unitLabel=""
            subjectPillSubject="your price"
          />
          <div
            data-comps-fallback-note
            className="mt-2 rounded-lg px-3 py-2 text-[11px]"
            style={{
              background: "rgba(255,179,0,0.08)",
              color: piq.textMuted,
              border: `0.5px solid ${piq.border}`,
              lineHeight: 1.5,
            }}
          >
            RentCast returned sqft on only {sqftCompCount} of {totalSalesComps}{" "}
            comp{totalSalesComps === 1 ? "" : "s"}, so this chart bins by{" "}
            <strong>sale price</strong> instead of price-per-sqft.
          </div>
        </>
      ) : (
        <div
          data-comps-empty
          className="rounded-xl text-center py-12 px-4"
          style={{
            background: piq.canvas,
            border: `0.5px dashed ${piq.border}`,
            color: piq.textMuted,
            fontSize: "13px",
          }}
        >
          {totalSalesComps === 0 ? (
            <>No sales comps yet — fetch property data to populate.</>
          ) : (
            <>
              {totalSalesComps} comp{totalSalesComps === 1 ? "" : "s"} loaded,
              but only {priceCompCount} had a sale price and {sqftCompCount} had
              sqft — not enough to chart. See the table below for the raw
              comparables.
            </>
          )}
        </div>
      )}
    </div>
  );
}
