"use client";

import Link from "next/link";
import { useSavedAnalysis } from "@/lib/analyzer/useSavedAnalysis";
import type { RentalResult } from "@propertyiq/analyzer-core";
import { Hero } from "../../components/Hero/Hero";
import { ThreeStrategyGrid } from "../../components/StrategyCompare/ThreeStrategyGrid";
import { MarketContextSection } from "../../components/sections/MarketContextSection";
import {
  buildKpiTilesFromRental,
  buildStrategyCardsFromResult,
  extractMarketContextProps,
} from "../../lib/saved-render-builders";
import {
  deriveVerdict,
  resolveSavedAnalysisLabel,
} from "../../lib/format-helpers";
import type { RichResultSnapshot } from "../../lib/analyzer-snapshot-types";

export default function SavedClient({ id }: { id: string }) {
  const { data: row, isLoading } = useSavedAnalysis(id);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-on-surface-variant">
        <p>Loading…</p>
        <Link
          href="/analyzer"
          className="mt-4 inline-block text-primary hover:underline"
        >
          ← Back to Analyzer
        </Link>
      </div>
    );
  }
  if (!row) {
    return (
      <div className="p-12 text-center text-on-surface-variant">
        <p>Not found.</p>
        <Link
          href="/analyzer"
          className="mt-4 inline-block text-primary hover:underline"
        >
          ← Back to Analyzer
        </Link>
      </div>
    );
  }

  const result = row.result_snapshot as Partial<RichResultSnapshot>;
  const rental = (result.rental ?? {}) as Partial<RentalResult>;
  const flip = result.flip ?? null;
  const brrrr = result.brrrr ?? null;
  const notes = result.notes?.trim() ? result.notes : null;
  // Pre-awaited + persisted at save time (see AnalyzerHeaderActions) — never
  // refetched here, so opening a saved analysis is a zero-network render.
  const ai = (result.aiNarratives ?? {}) as NonNullable<
    RichResultSnapshot["aiNarratives"]
  >;

  const piqScore =
    (row.market_context as { piq_score?: { value?: number | null } } | null)
      ?.piq_score?.value ?? null;
  const verdict = deriveVerdict({
    capRatePct: rental.capRatePct ?? null,
    dscr: rental.dscr ?? null,
    cashflowMonthly: rental.cashflowMonthly ?? null,
    piqScore,
  });
  const kpiTiles = buildKpiTilesFromRental(rental);
  const strategyCards = buildStrategyCardsFromResult(rental, flip, brrrr);
  const marketProps = extractMarketContextProps(row.market_context, ai);

  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link
          href="/analyzer"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          ← Back to Analyzer
        </Link>
        <h1 className="text-3xl font-light text-on-surface mb-2">
          {resolveSavedAnalysisLabel(row)}
        </h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Saved {new Date(row.created_at).toLocaleDateString()}
        </p>

        <div className="space-y-6">
          <Hero
            verdict={verdict}
            kpiTiles={kpiTiles}
            aiText={ai.recommendation_analysis ?? null}
          />
          <ThreeStrategyGrid strategies={strategyCards} />
          {row.market_context && <MarketContextSection {...marketProps} />}
          {notes && (
            <section className="rounded-xl bg-surface border border-outline-variant p-4 space-y-2">
              <h3 className="text-sm font-semibold text-on-surface">
                My Notes
              </h3>
              <p className="text-sm text-on-surface whitespace-pre-wrap">
                {notes}
              </p>
              {result.shareNotes && (
                <p className="text-xs text-on-surface-variant">
                  Shared with client (visible in the share link).
                </p>
              )}
            </section>
          )}
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
