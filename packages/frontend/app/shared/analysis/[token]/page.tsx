/**
 * Public read-only shared analysis page.
 *
 * Accessed via /shared/analysis/<share_token> with NO auth — the share token
 * itself is the capability. Backend endpoint /api/analyzer/share/:token uses a
 * SECURITY DEFINER Postgres function that strips PII (owner_id, full address,
 * lat/lon) before returning the row, so anything we render here is safe.
 *
 * Market context is always revealed (locked=false) because the analysis was
 * saved by a Pro user at the time of share.
 */

import { fetchSharedAnalysis } from "@/lib/data";
import type { MarketContext } from "@/lib/data";
import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";
import { notFound } from "next/navigation";
import HeroMetrics from "@/app/analyzer/components/HeroMetrics";
import StrategyTabs from "@/app/analyzer/components/StrategyTabs";
import MarketContextTile from "@/app/analyzer/components/MarketContextTile";

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

        <div className="space-y-4">
          <HeroMetrics
            capRatePct={rental.capRatePct ?? null}
            cocPct={rental.cashOnCashPct ?? null}
            cashflowMonthly={rental.cashflowMonthly ?? null}
            dscr={rental.dscr ?? null}
          />
          <StrategyTabs
            rental={rental as RentalResult}
            flip={flip}
            brrrr={brrrr}
          />
          {row.market_context && (
            <MarketContextTile
              context={row.market_context as unknown as MarketContext}
              locked={false}
            />
          )}
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
