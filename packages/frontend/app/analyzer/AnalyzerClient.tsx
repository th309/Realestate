"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useEntitlements } from "@/lib/entitlements";
import { ModeProvider } from "./lib/mode-context";
import { ModeToolbar } from "./components/chrome/ModeToolbar";
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
  deriveVerdict,
  verdictToGradeLetter,
  verdictToQualifier,
} from "./lib/format-helpers";
import { DealGrade } from "./components/primitives/DealGrade";
import { StrategyKPI } from "./components/Hero/StrategyKPI";
import { PropertyHeader } from "./components/PropertyHeader";
import { RentcastDevStrip } from "./components/RentcastDevStrip";
import { RentcastBanners } from "./components/RentcastBanners";
import { computeBestPlay } from "./lib/strategy-best-play";
import { buildCompsViewProps } from "./lib/comps-view-props";
import type { Strategy } from "./lib/strategy-tile-mappers";
import type { AnalysisMode } from "./components/InputPanel/StrategyControls";

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
    paramZip: params.zip,
  });
  const {
    analyzer,
    address,
    setAddress,
    arvLocal,
    setArvLocal,
    rehabBudget,
    setRehabBudget,
    assumptions,
    setAssumption,
    propertyType,
    setPropertyType,
    unitCount,
    setUnitCount,
    propertyClass,
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
    marketContext,
    piqByGeo,
  } = state;
  const { rental, flip, brrrr } = analyzer;

  const [inputsOpenMobile, setInputsOpenMobile] = useState(false);

  const verdict = deriveVerdict({
    capRatePct: rental.capRatePct,
    dscr: rental.dscr,
    cashflowMonthly: rental.cashflowMonthly,
    piqScore: marketContext?.piq_score?.value ?? null,
  });

  // Hero verdict is "pending" until we have the minimum signal needed to
  // derive a grade: a non-zero price AND either rent or a comp-derived cap
  // rate. Avoids the "fail-loud C/Marginal" sentinel from deriveVerdict.
  const hasGradableInput =
    (analyzer.input.price ?? 0) > 0 &&
    ((analyzer.input.rentMonthly ?? 0) > 0 || rental.capRatePct != null);

  const router = useRouter();
  const bestPlay = computeBestPlay(rental, flip, brrrr, projection);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("focused");
  const [focusedStrategy, setFocusedStrategy] = useState<Strategy>(bestPlay);
  // In compare mode the user hasn't picked — surface the bestPlay in the hero
  // so DealGrade + KPI tiles reflect the winning strategy.
  const activeStrategy: Strategy =
    analysisMode === "compare" ? bestPlay : focusedStrategy;

  const displayAddress =
    rentcastData?.resolved_address ?? (address.trim() || null);

  const pickStrategy = (s: Strategy) => {
    setFocusedStrategy(s);
    if (analysisMode === "compare") setAnalysisMode("focused");
  };

  const strategyProps = buildStrategyCompareProps({
    rental,
    flip,
    brrrr,
    breakEven,
    brrrrTimeline,
    projection,
    bestPlay,
    onPickStrategy: pickStrategy,
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

  const compsView = buildCompsViewProps(
    rentcastData,
    analyzer.input.price ?? 0,
  );
  const {
    salesComps,
    rentalComps,
    pricePerSqftValues,
    yourPricePerSqft,
    subjectLat,
    subjectLon,
    mapboxToken,
  } = compsView;
  const lookupErrorMsg = propertyLookup.error
    ? String(propertyLookup.error.message ?? propertyLookup.error)
    : null;

  const inputPanel = (
    <InputPanel
      input={analyzer.input}
      arv={arvLocal}
      onChange={analyzer.setInput}
      onArvChange={setArvLocal}
      rehabBudget={rehabBudget}
      onRehabBudgetChange={setRehabBudget}
      assumptions={assumptions}
      onAssumptionChange={setAssumption}
      address={address}
      onAddressChange={setAddress}
      isPro={isPro}
      isFetching={propertyLookup.isPending}
      onFetchProperty={() => {
        // Persist the address to the URL so a page refresh re-fires the
        // auto-fetch path in use-analyzer-state.ts. Combined with the 30-day
        // Redis cache on the backend, refresh becomes ~instant — no second
        // RentCast roundtrip needed for the same address.
        const trimmed = address.trim();
        if (trimmed.length > 0) {
          const next = `/analyzer?address=${encodeURIComponent(trimmed)}`;
          router.replace(next);
        }
        propertyLookup.mutate({ address });
      }}
      rentCastState={rentcastData ? "fresh" : "missing"}
      activeStrategy={activeStrategy}
      analysisMode={analysisMode}
      onAnalysisModeChange={setAnalysisMode}
      onStrategyChange={setFocusedStrategy}
      propertyType={propertyType}
      onPropertyTypeChange={setPropertyType}
      unitCount={unitCount}
      onUnitCountChange={setUnitCount}
      propertyClass={propertyClass}
    />
  );

  return (
    <ModeProvider>
      <main className="min-h-screen bg-surface">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <header className="flex items-center justify-between mb-4 gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-on-surface">
              Deal Analyzer
            </h1>
            <ModeToolbar />
          </header>

          {displayAddress && (
            <PropertyHeader address={displayAddress} piqByGeo={piqByGeo} />
          )}

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

              <DealGrade
                grade={verdictToGradeLetter(verdict)}
                qualifier={verdictToQualifier(verdict)}
                aiVerdict={aiVerdict}
                isStreaming={isStreaming}
                isPro={isPro}
                strategy={
                  activeStrategy === "buyAndHold" ? "buy-hold" : activeStrategy
                }
                onUpgrade={() => router.push("/pricing")}
                pending={!hasGradableInput}
              />

              <StrategyKPI
                ctx={{
                  input: analyzer.input,
                  rental,
                  flip,
                  brrrr,
                  projection,
                  breakEven,
                  afterTax,
                  arv: arvLocal,
                  rehabBudget,
                }}
                active={activeStrategy}
                isCompareWinner={analysisMode === "compare"}
              />

              <StrategyCompare
                {...strategyProps}
                isDealViable={
                  hasGradableInput && verdict !== "bad" && verdict !== "avoid"
                }
              />

              {process.env.NODE_ENV !== "production" && (
                <RentcastDevStrip
                  tier={entitlements.tier}
                  isPro={isPro}
                  address={address}
                  propertyLookup={propertyLookup}
                />
              )}

              <RentcastBanners
                lookupErrorMsg={lookupErrorMsg}
                quotaExceeded={quotaExceeded}
                rentcastData={rentcastData}
                address={address}
              />

              <ProjectionSection
                input={analyzer.input}
                projection={projection}
                afterTax={afterTax}
              />
              <ExpenseSection
                grossRentMonthly={grossRentMonthly}
                vacancyMonthly={vacancyMonthly}
                opexMonthly={opexAnnual / 12}
                debtServiceMonthly={debtServiceMonthly}
              />
              <SensitivitySection
                input={analyzer.input}
                rental={rental}
                flip={flip}
                brrrr={brrrr}
                arv={arvLocal}
                rehabBudget={rehabBudget}
                activeStrategy={activeStrategy}
                salesComps={salesComps}
              />
              <CompsSection
                subjectLat={subjectLat}
                subjectLon={subjectLon}
                subjectAddress={displayAddress}
                pricePerSqftValues={pricePerSqftValues}
                yourPricePerSqft={yourPricePerSqft}
                salesComps={salesComps}
                rentalComps={rentalComps}
                mapboxToken={mapboxToken}
              />
              <MarketContextSection
                chain={marketContext?.chain ?? null}
                initialGeoLevel={marketContext?.geo_level ?? null}
                fallbackPiq={marketContext?.piq_score?.value ?? null}
                fallbackHomeValue={marketContext?.home_value?.value ?? null}
                fallbackRentIndex={marketContext?.rent_index?.value ?? null}
                fallbackMarketHeat={marketContext?.market_heat?.value ?? null}
                fallbackNetMigration={
                  marketContext?.net_migration?.value ?? null
                }
              />
              <AfterTaxSection
                afterTax={afterTax}
                marginalTaxRate={assumptions.marginalTaxRate}
              />
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
