"use client";

import { useEffect, useState } from "react";
import { fetchSavedAnalysis, type SavedAnalysis } from "@/lib/data";
import HeroMetrics from "../../components/HeroMetrics";
import StrategyTabs from "../../components/StrategyTabs";
import MarketContextTile from "../../components/MarketContextTile";

export default function SavedClient({ id }: { id: string }) {
  const [row, setRow] = useState<SavedAnalysis | null | "loading">("loading");

  useEffect(() => {
    fetchSavedAnalysis(id).then(setRow);
  }, [id]);

  if (row === "loading") {
    return (
      <div className="p-12 text-center text-on-surface-variant">Loading…</div>
    );
  }
  if (!row) {
    return (
      <div className="p-12 text-center text-on-surface-variant">Not found.</div>
    );
  }

  const r = row.result_snapshot as Record<string, any>;
  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-light text-on-surface mb-2">
          {row.label || `${row.address_city}, ${row.address_state}`}
        </h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Saved {new Date(row.created_at).toLocaleDateString()}
        </p>
        <div className="space-y-4">
          <HeroMetrics
            capRatePct={r.rental?.capRatePct ?? null}
            cocPct={r.rental?.cashOnCashPct ?? null}
            cashflowMonthly={r.rental?.cashflowMonthly ?? null}
            dscr={r.rental?.dscr ?? null}
          />
          <StrategyTabs
            rental={r.rental as any}
            flip={r.flip ?? null}
            brrrr={r.brrrr ?? null}
          />
          {row.market_context && (
            <MarketContextTile
              context={row.market_context as any}
              locked={false}
            />
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
