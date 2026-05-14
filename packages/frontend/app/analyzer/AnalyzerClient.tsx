"use client";

import { use, useState } from "react";
import AddressBar from "./components/AddressBar";
import { useAnalyzer } from "@/lib/analyzer/useAnalyzer";
import {
  useMarketContext,
  isQuotaExceeded,
} from "@/lib/analyzer/useMarketContext";
import type { AddressSuggestion } from "@/lib/analyzer/types";

export default function AnalyzerClient({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{
    address?: string;
    zip?: string;
    piq_market?: string;
  }>;
}) {
  const sp = use(searchParamsPromise);
  const [address, setAddress] = useState<AddressSuggestion | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const analyzer = useAnalyzer();
  const market = useMarketContext({
    zip: address?.postalCode ?? sp.zip,
    state: address?.state,
  });

  const quotaExceeded = isQuotaExceeded(market.data);

  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-light text-on-surface mb-2">
            Deal Analyzer
          </h1>
          <p className="text-on-surface-variant">
            Analyze any US property. Cap rate, cashflow, BRRRR — plus PropertyIQ
            market context.
          </p>
        </header>

        <div className="mb-6">
          <AddressBar onSelect={setAddress} />
        </div>

        {quotaExceeded ? (
          <div className="rounded-2xl bg-primary-container p-8 text-center">
            <h2 className="text-2xl text-on-primary-container mb-3">
              You&apos;ve used your 3 free analyses.
            </h2>
            <p className="text-on-primary-container mb-6">
              Sign up free to keep going. Pro unlocks AI verdict, market
              context, save &amp; share.
            </p>
            <a
              href="/auth/sign-up"
              className="inline-block px-8 py-3 rounded-full bg-primary text-on-primary"
            >
              Sign up free
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[38%_1fr] gap-6">
            <aside className="rounded-2xl bg-surface-container-low p-5">
              {/* InputForm — Task 17 */}
              <p className="text-on-surface-variant">Input form goes here…</p>
            </aside>
            <section className="rounded-2xl bg-surface-container-low p-5">
              {/* Results — Task 18 */}
              <p className="text-on-surface-variant">
                Results panel goes here…
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
