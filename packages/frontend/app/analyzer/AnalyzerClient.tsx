"use client";

import { use, useState } from "react";
import { useEntitlements } from "@/lib/entitlements";
import { ModeProvider } from "./lib/mode-context";
import { ModeToolbar } from "./components/chrome/ModeToolbar";
import { Hero } from "./components/Hero/Hero";
import { StrategyCompare } from "./components/StrategyCompare/StrategyCompare";
import { InputPanel } from "./components/InputPanel/InputPanel";
import { ProjectionSection } from "./components/sections/ProjectionSection";
import { ExpenseSection } from "./components/sections/ExpenseSection";
import { SensitivitySection } from "./components/sections/SensitivitySection";
import { CompsSection } from "./components/sections/CompsSection";
import { MarketContextSection } from "./components/sections/MarketContextSection";
import { AfterTaxSection } from "./components/sections/AfterTaxSection";
import { NotesSection } from "./components/sections/NotesSection";
import { EditInputsFab } from "./components/chrome/EditInputsFab";
import { useAnalyzerState } from "./lib/use-analyzer-state";
import { buildStrategyCompareProps } from "./lib/strategy-compare-builders";
import {
  fmtPct,
  fmtUsd,
  fmtRatio,
  deriveGradeScore,
} from "./lib/format-helpers";

export default function AnalyzerClient({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{
    address?: string;
    zip?: string;
    piq_market?: string;
  }>;
}) {
  const params = use(searchParamsPromise);
  const entitlements = useEntitlements();
  const isPro = ["pro", "enterprise", "admin"].includes(
    entitlements.tier ?? "free",
  );

  const state = useAnalyzerState({
    isPro,
    initialAddress: params.address ?? "",
    paramAddress: params.address,
  });
  const {
    analyzer,
    address,
    setAddress,
    arvLocal,
    setArvLocal,
    propertyLookup,
    rentcastData,
    quotaExceeded,
    projection,
    sensitivity,
    afterTax,
    breakEven,
    brrrrTimeline,
    aiVerdict,
    isStreaming,
  } = state;
  const { rental, flip, brrrr } = analyzer;

  const [inputsOpenMobile, setInputsOpenMobile] = useState(false);

  const score = deriveGradeScore(rental.capRatePct, rental.dscr);
  const strategyProps = buildStrategyCompareProps({
    rental,
    flip,
    brrrr,
    breakEven,
    brrrrTimeline,
    projection,
  });

  const grossRentMonthly = analyzer.input.rentMonthly ?? 0;
  const debtServiceMonthly = rental.monthlyDebtService;
  const opexAnnual =
    (analyzer.input.taxAnnual ?? 0) +
    (analyzer.input.insuranceAnnual ?? 0) +
    (analyzer.input.hoaMonthly ?? 0) * 12 +
    grossRentMonthly *
      12 *
      ((analyzer.input.maintenancePctOfRent ?? 0.08) +
        (analyzer.input.managementPctOfRent ?? 0.08));
  const vacancyMonthly =
    grossRentMonthly * (analyzer.input.vacancyPctOfRent ?? 0.05);

  const irrBandByYear = projection.yearly
    .filter((y: (typeof projection.yearly)[number]) =>
      [1, 3, 5, 10, 20, 30].includes(y.year),
    )
    .map((y: (typeof projection.yearly)[number]) => ({
      year: y.year,
      value: y.irrToDate,
      bandLow: y.irrToDate * 0.7,
      bandHigh: y.irrToDate * 1.3,
    }));

  // Comps-section data sourced from RentCast lookup (lat/lon + price/sqft)
  type RawComp = {
    address: string;
    lat?: number | null;
    lon?: number | null;
    price?: number | null;
    rent?: number | null;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    distance?: number;
  };
  const salesComps = (rentcastData?.sales_comps ?? []) as RawComp[];
  const rentalComps = (rentcastData?.rental_comps ?? []) as RawComp[];
  const pricePerSqftValues = salesComps
    .map((c) => (c.price && c.sqft && c.sqft > 0 ? c.price / c.sqft : null))
    .filter((v): v is number => v != null);
  const yourPricePerSqft =
    analyzer.input.price && pricePerSqftValues.length > 0
      ? analyzer.input.price / (pricePerSqftValues.length * 0 + 1500) // fallback est sqft 1500
      : (pricePerSqftValues[0] ?? 0);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const lookupErrorMsg = propertyLookup.error
    ? String(propertyLookup.error.message ?? propertyLookup.error)
    : null;

  const inputPanel = (
    <InputPanel
      input={analyzer.input}
      arv={arvLocal}
      onChange={analyzer.setInput}
      onArvChange={setArvLocal}
      address={address}
      onAddressChange={setAddress}
      isPro={isPro}
      isFetching={propertyLookup.isPending}
      onFetchProperty={() => propertyLookup.mutate({ address })}
      rentCastState={rentcastData ? "fresh" : "missing"}
    />
  );

  return (
    <ModeProvider>
      <main className="min-h-screen bg-surface">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <header className="flex items-center justify-between mb-6 gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-on-surface">
              Deal Analyzer
            </h1>
            <ModeToolbar />
          </header>

          <div className="grid grid-cols-1 md:grid-cols-[62%_38%] gap-6">
            <div className="space-y-6 min-w-0">
              {!address.trim() && !rentcastData && (
                <div
                  data-empty-cta
                  className="rounded-xl border-2 border-dashed border-[var(--md-primary)] bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] px-5 py-4"
                >
                  <div className="font-semibold mb-1">
                    Enter a property address to get started →
                  </div>
                  <div className="text-sm">
                    Type the address in the panel on the right{" "}
                    {isPro ? (
                      <>
                        and click{" "}
                        <strong>Fetch property + comps from RentCast</strong> to
                        auto-populate price, rent, and comps. Or open this page
                        with{" "}
                        <code className="font-mono text-xs">
                          ?address=YOUR+ADDRESS
                        </code>{" "}
                        to auto-fetch on load.
                      </>
                    ) : (
                      <>
                        (Pro feature: RentCast lookup not available on free
                        tier).
                      </>
                    )}
                  </div>
                </div>
              )}

              <Hero
                score={score}
                aiText={
                  aiVerdict ||
                  (isPro ? null : "Pro members get a streaming AI verdict.")
                }
                aiIsStreaming={isStreaming}
                kpiTiles={[
                  {
                    label: "Cap Rate",
                    value: fmtPct(
                      rental.capRatePct ? rental.capRatePct / 100 : null,
                    ),
                  },
                  {
                    label: "Cashflow",
                    value:
                      rental.cashflowMonthly != null
                        ? `${fmtUsd(rental.cashflowMonthly)}/mo`
                        : "—",
                  },
                  { label: "DSCR", value: fmtRatio(rental.dscr) },
                  {
                    label: "IRR (10y)",
                    value: fmtPct(projection.horizons.y10.irr),
                  },
                ]}
              />

              <StrategyCompare {...strategyProps} />

              {/* Always-visible debug box: tells us at a glance what state the RentCast lookup is in. */}
              <div
                data-rentcast-debug
                className="rounded-xl border border-outline-variant bg-surface-container-low text-xs px-3 py-2 font-mono text-on-surface-variant flex flex-wrap gap-x-4 gap-y-1"
              >
                <span>
                  tier: <strong>{entitlements.tier ?? "?"}</strong>
                </span>
                <span>
                  isPro: <strong>{String(isPro)}</strong>
                </span>
                <span>
                  address: <strong>{address || "(empty)"}</strong>
                </span>
                <span>
                  lookup:{" "}
                  <strong>
                    {propertyLookup.isPending
                      ? "pending…"
                      : propertyLookup.isSuccess
                        ? "success"
                        : propertyLookup.isError
                          ? "error"
                          : "idle"}
                  </strong>
                </span>
                {!propertyLookup.data && !propertyLookup.isPending && (
                  <button
                    onClick={() =>
                      propertyLookup.mutate({ address: address.trim() })
                    }
                    className="underline text-[var(--md-primary)]"
                  >
                    Force fetch
                  </button>
                )}
              </div>

              {(lookupErrorMsg || quotaExceeded) && (
                <div
                  data-rentcast-status
                  role="alert"
                  className="rounded-xl border-2 border-[var(--md-error)] bg-[var(--md-error-container)] text-[var(--md-on-error-container)] px-4 py-3 text-sm"
                >
                  <strong>RentCast lookup failed:</strong>{" "}
                  {quotaExceeded
                    ? "monthly quota exceeded — try again next month."
                    : lookupErrorMsg}
                </div>
              )}

              {rentcastData && rentcastData.errors && (
                <div
                  data-rentcast-partial-errors
                  role="alert"
                  className="rounded-xl border-2 border-[var(--md-warning)] bg-[var(--md-error-container)] text-[var(--md-on-error-container)] px-4 py-3 text-xs"
                >
                  <strong>RentCast partial failure:</strong>
                  <ul className="mt-1 list-disc list-inside">
                    {rentcastData.errors.property && (
                      <li>property: {rentcastData.errors.property}</li>
                    )}
                    {rentcastData.errors.avm && (
                      <li>avm: {rentcastData.errors.avm}</li>
                    )}
                    {rentcastData.errors.rent && (
                      <li>rent: {rentcastData.errors.rent}</li>
                    )}
                  </ul>
                </div>
              )}

              {rentcastData && (
                <div
                  data-rentcast-status
                  className="rounded-xl border border-[var(--md-tertiary)] bg-[var(--md-tertiary-container)] text-[var(--md-on-tertiary-container)] px-4 py-3 text-xs flex flex-wrap gap-x-6 gap-y-1"
                >
                  <span>
                    <strong>RentCast:</strong> AVM{" "}
                    {rentcastData.avm
                      ? fmtUsd(rentcastData.avm.value)
                      : "unavailable"}
                  </span>
                  <span>
                    Rent{" "}
                    {rentcastData.rent
                      ? `${fmtUsd(rentcastData.rent.value)}/mo`
                      : "unavailable"}
                  </span>
                  <span>
                    Sales comps {rentcastData.sales_comps.length} · Rental comps{" "}
                    {rentcastData.rental_comps.length}
                  </span>
                </div>
              )}

              <ProjectionSection projection={projection} />
              <ExpenseSection
                grossRentMonthly={grossRentMonthly}
                vacancyMonthly={vacancyMonthly}
                opexMonthly={opexAnnual / 12}
                debtServiceMonthly={debtServiceMonthly}
              />
              <SensitivitySection
                sensitivity={sensitivity}
                irrBandByYear={irrBandByYear}
              />
              <CompsSection
                subjectLat={null}
                subjectLon={null}
                pricePerSqftValues={pricePerSqftValues}
                yourPricePerSqft={yourPricePerSqft}
                salesComps={salesComps}
                rentalComps={rentalComps}
                mapboxToken={mapboxToken}
              />
              <MarketContextSection
                piqScore={null}
                homeValue={null}
                rentIndex={null}
                marketHeat={null}
                netMigration={null}
              />
              <AfterTaxSection afterTax={afterTax} />
              <NotesSection />
            </div>

            <div className="hidden md:block">
              <div className="sticky top-6">{inputPanel}</div>
            </div>
          </div>
        </div>

        <EditInputsFab
          open={inputsOpenMobile}
          onToggle={() => setInputsOpenMobile((v) => !v)}
        >
          {inputPanel}
        </EditInputsFab>
      </main>
    </ModeProvider>
  );
}
