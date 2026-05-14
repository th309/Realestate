"use client";

import { use, useEffect, useState } from "react";
import AddressBar from "./components/AddressBar";
import InputForm from "./components/InputForm";
import HeroMetrics from "./components/HeroMetrics";
import StrategyTabs from "./components/StrategyTabs";
import MarketContextTile from "./components/MarketContextTile";
import AIVerdictModal from "./components/AIVerdictModal";
import ActionsRow from "./components/ActionsRow";
import { useAnalyzer } from "@/lib/analyzer/useAnalyzer";
import {
  useMarketContext,
  isQuotaExceeded,
} from "@/lib/analyzer/useMarketContext";
import { useEntitlements } from "@/lib/entitlements";
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
  // Optional county FIPS sourced from a `?piq_market=county:<fips>` deep-link.
  // Kept separate from AddressSuggestion since the autocomplete shape doesn't carry county_fips.
  const [piqCountyFips, setPiqCountyFips] = useState<string | undefined>(
    undefined,
  );
  const analyzer = useAnalyzer();
  const market = useMarketContext({
    zip: address?.postalCode ?? sp.zip,
    county_fips: piqCountyFips,
    state: address?.state,
  });

  // Parse `?piq_market=<level>:<id>` and pre-fill enough state to trigger market-context lookup.
  // Supported: zip, state, county. Metro is a known limitation — useMarketContext takes no metro/cbsa param.
  useEffect(() => {
    if (!sp.piq_market) return;
    const idx = sp.piq_market.indexOf(":");
    if (idx <= 0) return;
    const level = sp.piq_market.slice(0, idx);
    const id = sp.piq_market.slice(idx + 1);
    if (!level || !id) return;

    if (level === "zip") {
      setAddress({
        id: "piq-zip-" + id,
        full: `ZIP ${id}`,
        street: "",
        city: "",
        state: "",
        postalCode: id,
        lat: 0,
        lon: 0,
      });
    } else if (level === "state") {
      setAddress({
        id: "piq-state-" + id,
        full: `State ${id}`,
        street: "",
        city: "",
        state: id,
        postalCode: null,
        lat: 0,
        lon: 0,
      });
    } else if (level === "county") {
      setPiqCountyFips(id);
    }
    // level === "metro": no direct useMarketContext param — user must refine via the address bar.
  }, [sp.piq_market]);

  const { tier } = useEntitlements();
  const isPro = ["pro", "enterprise", "admin"].includes(tier);

  const quotaExceeded = isQuotaExceeded(market.data);

  const [fieldStatus, setFieldStatus] = useState<any>({});
  const [verdictOpen, setVerdictOpen] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    if (!market.data || isQuotaExceeded(market.data)) return;
    const ctx = market.data;
    const newStatus: any = {};
    if (ctx.rent_index?.value != null) {
      analyzer.setField("rentMonthly", ctx.rent_index.value);
      newStatus.rentMonthly = { autoFilled: true };
    } else {
      newStatus.rentMonthly = { unavailable: true };
    }
    if (ctx.home_value?.value != null && !analyzer.input.price) {
      analyzer.setField("price", ctx.home_value.value);
      newStatus.price = { autoFilled: true };
    }
    newStatus.insuranceAnnual = { unavailable: true };
    setFieldStatus(newStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market.data]);

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
            <details
              className="md:hidden rounded-2xl bg-surface-container-low p-4"
              open
            >
              <summary className="cursor-pointer font-medium text-on-surface">
                Inputs
              </summary>
              <div className="mt-3">
                <InputForm
                  input={analyzer.input}
                  fieldStatus={fieldStatus}
                  setField={analyzer.setField}
                  setFinancing={analyzer.setFinancing}
                />
              </div>
            </details>
            <aside className="hidden md:block rounded-2xl bg-surface-container-low p-5">
              <InputForm
                input={analyzer.input}
                fieldStatus={fieldStatus}
                setField={analyzer.setField}
                setFinancing={analyzer.setFinancing}
              />
            </aside>
            <section className="rounded-2xl bg-surface-container-low p-5">
              <div className="space-y-3">
                <HeroMetrics
                  capRatePct={analyzer.rental.capRatePct}
                  cocPct={analyzer.rental.cashOnCashPct}
                  cashflowMonthly={analyzer.rental.cashflowMonthly}
                  dscr={analyzer.rental.dscr}
                />
                <StrategyTabs
                  rental={analyzer.rental}
                  flip={analyzer.flip}
                  brrrr={analyzer.brrrr}
                />
                <MarketContextTile
                  context={
                    market.data && !isQuotaExceeded(market.data)
                      ? market.data
                      : null
                  }
                  locked={!isPro}
                />
                <ActionsRow
                  isPro={isPro}
                  payload={() => ({
                    label: address?.full ?? null,
                    address_full: address?.full ?? null,
                    address_city: address?.city ?? "",
                    address_state: address?.state ?? "",
                    address_zip: address?.postalCode ?? null,
                    lat: address?.lat ?? null,
                    lon: address?.lon ?? null,
                    input_snapshot: analyzer.input as any,
                    result_snapshot: {
                      rental: analyzer.rental,
                      flip: analyzer.flip,
                      brrrr: analyzer.brrrr,
                    } as any,
                    market_context:
                      market.data && !isQuotaExceeded(market.data)
                        ? (market.data as any)
                        : null,
                    ai_verdict: null,
                  })}
                  onVerdictClick={() => setVerdictOpen(true)}
                  onSaved={(r) =>
                    setSavedToast(
                      `Saved — share at /shared/analysis/${r.share_token}`,
                    )
                  }
                />
              </div>
            </section>
          </div>
        )}
      </div>
      {verdictOpen && (
        <AIVerdictModal
          input={analyzer.input}
          result={{
            rental: analyzer.rental,
            flip: analyzer.flip,
            brrrr: analyzer.brrrr,
          }}
          marketContext={
            market.data && !isQuotaExceeded(market.data)
              ? market.data
              : undefined
          }
          onClose={() => setVerdictOpen(false)}
        />
      )}
      {savedToast && (
        <div className="fixed bottom-6 right-6 bg-primary text-on-primary px-5 py-3 rounded-2xl shadow-lg">
          {savedToast}
        </div>
      )}
    </main>
  );
}
