"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSavedAnalysis } from "@/lib/analyzer/useSavedAnalysis";
import { migrateDealState } from "../../lib/migrate-snapshot";
import AnalyzerClient from "../../AnalyzerClient";
import type { MarketContext } from "@/lib/data/fetchers/analyzer";

/**
 * A saved deal carries its own address in `initialState`, so there is
 * nothing for `?address=` to supply. Module-scope (not an inline
 * `Promise.resolve({})`) because `AnalyzerClient` reads it with `use()` —
 * a fresh promise every render would re-suspend the page forever.
 */
const NO_SEARCH_PARAMS = Promise.resolve({});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-12 text-center text-on-surface-variant">
      {children}
      <Link
        href="/analyzer"
        className="mt-4 inline-block text-primary hover:underline"
      >
        ← Back to Analyzer
      </Link>
    </div>
  );
}

/**
 * Loads a saved deal and hands it to the LIVE analyzer as seed state.
 *
 * Replaces the previous read-only report: opening a saved deal now means
 * resuming work on it. The client-facing report still exists at
 * /shared/analysis/[token].
 *
 * `migrateDealState` never throws, so a corrupt row opens as an analyzer
 * seeded with defaults rather than as a crash.
 */
export default function SavedDealLoader({ id }: { id: string }) {
  const { data: row, isLoading } = useSavedAnalysis(id);
  // Paired, because `migrateDealState` never returns null — a missing ROW is
  // the only failure, so one null check has to cover both seeds.
  const saved = useMemo(
    () =>
      row
        ? {
            state: migrateDealState(row),
            // The market as it was when this deal was saved. Restored, never
            // refetched (spec §4.4) — see useMarketRefreshGate.
            marketContext: (row.market_context ?? null) as MarketContext | null,
          }
        : null,
    [row],
  );

  if (isLoading)
    return (
      <Shell>
        <p>Loading…</p>
      </Shell>
    );
  if (!saved)
    return (
      <Shell>
        <p>Not found.</p>
      </Shell>
    );

  return (
    <AnalyzerClient
      dealId={id}
      initialState={saved.state}
      initialMarketContext={saved.marketContext}
      searchParamsPromise={NO_SEARCH_PARAMS}
    />
  );
}
