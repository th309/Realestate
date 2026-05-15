"use client";

import { useSavedAnalysis } from "@/lib/analyzer/useSavedAnalysis";
import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";
import { Hero } from "../../components/Hero/Hero";
import { ThreeStrategyGrid } from "../../components/StrategyCompare/ThreeStrategyGrid";
import { MarketContextSection } from "../../components/sections/MarketContextSection";
import {
  buildKpiTilesFromRental,
  buildStrategyCardsFromResult,
  extractMarketContextProps,
} from "../../lib/saved-render-builders";
import { deriveGradeScore } from "../../lib/format-helpers";

export default function SavedClient({ id }: { id: string }) {
  const { data: row, isLoading } = useSavedAnalysis(id);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-on-surface-variant">Loading…</div>
    );
  }
  if (!row) {
    return (
      <div className="p-12 text-center text-on-surface-variant">Not found.</div>
    );
  }

  const result = row.result_snapshot as {
    rental?: Partial<RentalResult>;
    flip?: FlipResult | null;
    brrrr?: BrrrrResult | null;
  };
  const rental = (result.rental ?? {}) as Partial<RentalResult>;
  const flip = result.flip ?? null;
  const brrrr = result.brrrr ?? null;

  const score = deriveGradeScore(
    rental.capRatePct ?? null,
    rental.dscr ?? null,
  );
  const kpiTiles = buildKpiTilesFromRental(rental);
  const strategyCards = buildStrategyCardsFromResult(rental, flip, brrrr);
  const marketProps = extractMarketContextProps(row.market_context);

  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-light text-on-surface mb-2">
          {row.label || `${row.address_city}, ${row.address_state}`}
        </h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Saved {new Date(row.created_at).toLocaleDateString()}
        </p>

        <div className="space-y-6">
          <Hero score={score} kpiTiles={kpiTiles} />
          <ThreeStrategyGrid strategies={strategyCards} />
          {row.market_context && <MarketContextSection {...marketProps} />}
        </div>

        <div className="mt-8 text-center">
          <a
            href={`/shared/analysis/${row.share_token}`}
            className="text-primary hover:underline"
          >
            Share this analysis →
          </a>
        </div>
      </div>
    </main>
  );
}
