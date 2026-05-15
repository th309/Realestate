/**
 * Public read-only shared analysis page.
 *
 * Accessed via /shared/analysis/<share_token> with NO auth — the share token
 * itself is the capability. Backend endpoint /api/analyzer/share/:token uses a
 * SECURITY DEFINER Postgres function that strips PII (owner_id, full address,
 * lat/lon) before returning the row, so anything we render here is safe.
 *
 * Market context is always revealed because the analysis was saved by a Pro
 * user at the time of share.
 */

import { fetchSharedAnalysis } from "@/lib/data";
import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";
import { notFound } from "next/navigation";
import { Hero } from "@/app/analyzer/components/Hero/Hero";
import { ThreeStrategyGrid } from "@/app/analyzer/components/StrategyCompare/ThreeStrategyGrid";
import { MarketContextSection } from "@/app/analyzer/components/sections/MarketContextSection";
import {
  buildKpiTilesFromRental,
  buildStrategyCardsFromResult,
  extractMarketContextProps,
} from "@/app/analyzer/lib/saved-render-builders";
import { deriveGradeScore } from "@/app/analyzer/lib/format-helpers";

// Each token returns different data and there's no per-user variance worth
// caching, so render dynamically on every request.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedAnalysisPage({ params }: PageProps) {
  const { token } = await params;
  const row = await fetchSharedAnalysis(token);
  if (!row) notFound();

  const result = row.result_snapshot as {
    rental?: Partial<RentalResult>;
    flip?: FlipResult | null;
    brrrr?: BrrrrResult | null;
  };
  const rental = (result.rental ?? {}) as Partial<RentalResult>;
  const flip = result.flip ?? null;
  const brrrr = result.brrrr ?? null;

  const heading = row.label || `${row.address_city}, ${row.address_state}`;
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
        <header className="mb-8">
          <p className="text-sm text-on-surface-variant uppercase tracking-wide">
            PropertyIQ · Shared analysis
          </p>
          <h1 className="text-3xl font-light text-on-surface mt-2">
            {heading}
          </h1>
        </header>

        <div className="space-y-6">
          <Hero score={score} kpiTiles={kpiTiles} />
          <ThreeStrategyGrid strategies={strategyCards} />
          {row.market_context && <MarketContextSection {...marketProps} />}
        </div>

        <footer className="mt-12 pt-6 border-t border-outline-variant text-center">
          <a
            href="/analyzer"
            className="inline-block px-6 py-3 rounded-full bg-primary text-on-primary"
          >
            Analyze a property of your own →
          </a>
        </footer>
      </div>
    </main>
  );
}
