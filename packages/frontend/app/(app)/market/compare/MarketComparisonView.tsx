"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEntitlements } from "@/lib/entitlements";
import { PaywallCard } from "@/components/entitlements/PaywallCard";
import { MarketComparison } from "./MarketComparison";
import { PeerSearchBox } from "./PeerSearchBox";

function parseMarket(
  raw: string | null,
): { geoLevel: string; geoId: string } | null {
  if (!raw) return null;
  const m = raw.match(/^([a-z]+)-(.+)$/);
  return m ? { geoLevel: m[1], geoId: m[2] } : null;
}

export function MarketComparisonView() {
  const sp = useSearchParams();
  const router = useRouter();
  const { tier, loading } = useEntitlements();

  // Gated feature — Pro and above unlock the side-by-side tool. Wait for the
  // entitlements resolve first so a Pro user never flashes the paywall.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-on-surface-variant">
        Loading…
      </div>
    );
  }
  if (tier === "free") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <PaywallCard
          type="feature"
          id="market_comparison"
          title="Compare markets side by side"
          description="Line up any metro, county, or ZIP against its closest peer: scores, prices, rents, and momentum in one view. Available on Pro."
        />
      </div>
    );
  }

  const a = parseMarket(sp?.get("a") ?? sp?.get("market") ?? null);

  // No source market yet → let the user pick one instead of dead-ending.
  if (!a) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-on-surface">
            Compare markets
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Pick a market and we&apos;ll line it up against its closest peer.
          </p>
        </header>
        <PeerSearchBox
          placeholder="🔍  Search a metro, county, or ZIP"
          onPick={(m) =>
            router.push(`/market/compare?a=${m.geoLevel}-${m.geoId}`)
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-on-surface">
          How your market stacks up
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Side-by-side against the closest peer we found — or pick your own.
        </p>
      </header>
      <MarketComparison source={a} />
    </div>
  );
}
