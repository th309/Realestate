"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useEntitlements } from "@/lib/entitlements";
import { ModeProvider } from "./lib/mode-context";
import { ModeToolbar } from "./components/chrome/ModeToolbar";
import { StrategyCompare } from "./components/StrategyCompare/StrategyCompare";
import { InputPanel } from "./components/InputPanel/InputPanel";
import { EditInputsFab } from "./components/chrome/EditInputsFab";
import { useAnalyzerState } from "./lib/use-analyzer-state";
import { buildStrategyCompareProps } from "./lib/strategy-compare-builders";
import { deriveVerdict } from "./lib/format-helpers";
import { GradingResultPanel } from "./components/cards/GradingResultPanel";
import { AnalyzerSections } from "./components/AnalyzerSections";
import { CustomizeThresholdsDrawer } from "./components/CustomizeThresholdsDrawer/CustomizeThresholdsDrawer";
import { toEngineStrategy, useGradingResult } from "./lib/use-grading-result";
import { useAnalyzerDefaultsPrefill } from "./lib/use-analyzer-defaults-prefill";
import { StrategyKPI } from "./components/Hero/StrategyKPI";
import { PropertyHeader } from "./components/PropertyHeader";
import { PropertyRecordCard } from "./components/PropertyRecordCard";
import { RentcastBanners } from "./components/RentcastBanners";
import { useSelectedGoal } from "./lib/use-selected-goal";
import { GoalPicker } from "./components/StrategyCompare/GoalPicker";
import { useUpgradeProps } from "./lib/use-upgrade-props";
import { deriveCashflowSummary } from "./lib/cashflow-summary";
import { useSectionAiInsights } from "./lib/use-section-ai-insights";
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
  // prettier-ignore
  const {
    analyzer, address, setAddress, arvLocal, setArvLocal, rehabBudget,
    setRehabBudget, assumptions, setAssumption, propertyType, setPropertyType,
    unitCount, setUnitCount, propertyClass, propertyLookup, rentcastData,
    quotaExceeded, projection, sensitivity, afterTax, breakEven, brrrrTimeline,
    marketContext, piqByGeo,
  } = state;
  const { rental, flip, brrrr } = analyzer;

  const [inputsOpenMobile, setInputsOpenMobile] = useState(false);

  const verdict = deriveVerdict({
    capRatePct: rental.capRatePct,
    dscr: rental.dscr,
    cashflowMonthly: rental.cashflowMonthly,
    piqScore: marketContext?.piq_score?.value ?? null,
  });

  const hasGradableInput =
    (analyzer.input.price ?? 0) > 0 &&
    ((analyzer.input.rentMonthly ?? 0) > 0 || rental.capRatePct != null);

  const router = useRouter();
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("focused");
  // prettier-ignore
  const { selectedGoal, setSelectedGoal, bestPlay, noGoalFit } = useSelectedGoal(
    analyzer, projection, assumptions, analysisMode, hasGradableInput,
  );
  const [focusedStrategy, setFocusedStrategy] = useState<Strategy>(bestPlay);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useAnalyzerDefaultsPrefill({
    setInput: analyzer.setInput,
    setAssumption,
    currentInput: analyzer.input,
  });
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
    bestPlay: noGoalFit ? null : bestPlay,
    onPickStrategy: pickStrategy,
  });

  const { grossRentMonthly, debtServiceMonthly, opexAnnual, vacancyMonthly } =
    deriveCashflowSummary(analyzer.input, rental);

  const grading = useGradingResult({
    input: analyzer.input,
    activeStrategy,
    hasGradableInput,
    piqScore: marketContext?.piq_score?.value,
    arv: arvLocal,
    rehabBudget,
    holdingMonths: assumptions.holdingMonths,
    sellingCostsPct: assumptions.sellingCostsPct,
    marketZip: marketContext?.geo_id ?? undefined,
    refinanceLTVPct: assumptions.refinanceLTVPct,
    seasoningMonths: assumptions.seasoningMonths,
    rehabMonths: assumptions.rehabMonths,
  });
  const upgradeProps = useUpgradeProps({
    input: analyzer.input,
    setInput: analyzer.setInput,
    arvLocal,
    setArvLocal,
    rehabBudget,
    setRehabBudget,
    assumptions,
    setAssumption,
    marketZip: marketContext?.geo_id ?? undefined,
    marketPiqScore: marketContext?.piq_score?.value,
  });

  const sectionAi = useSectionAiInsights({
    enabled: isPro && hasGradableInput,
    input: analyzer.input,
    rental,
    flip,
    brrrr,
    rentcast: rentcastData,
    piq: marketContext,
    grading: grading.data ?? null,
    strategy: toEngineStrategy(activeStrategy) ?? null,
    piqByGeo,
    goal: selectedGoal,
  });

  const compsView = buildCompsViewProps(
    rentcastData,
    analyzer.input.price ?? 0,
  );
  const {
    salesComps,
    rentalComps,
    pricePerSqftValues,
    yourPricePerSqft,
    subjectPrice,
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
      rental={rental}
      flip={flip}
      brrrr={brrrr}
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

          <div className="grid grid-cols-1 md:grid-cols-[38%_62%] gap-6">
            <div className="hidden md:block">
              <div className="sticky top-6 max-h-[calc(100vh-2rem)] overflow-y-auto space-y-4 pr-1">
                {inputPanel}
                {rentcastData?.property_record && (
                  <PropertyRecordCard record={rentcastData.property_record} />
                )}
              </div>
            </div>

            <div className="space-y-6 min-w-0">
              {!address.trim() && !rentcastData && (
                <div
                  data-empty-cta
                  className="rounded-xl border-2 border-dashed border-[var(--md-primary)] bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] px-5 py-4"
                >
                  <div className="font-semibold mb-1">
                    ← Enter a property address to get started
                  </div>
                  <div className="text-sm">
                    Type the address in the panel on the left{" "}
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

              {analysisMode === "compare" && (
                <GoalPicker
                  selectedGoal={selectedGoal}
                  onChange={setSelectedGoal}
                />
              )}

              {analysisMode === "compare" && (
                <StrategyCompare
                  {...strategyProps}
                  isDealViable={
                    hasGradableInput && verdict !== "bad" && verdict !== "avoid"
                  }
                  selectedGoal={selectedGoal}
                  winner={bestPlay}
                  noGoalFit={noGoalFit}
                />
              )}

              {grading.data ? (
                <GradingResultPanel
                  result={grading.data}
                  input={analyzer.input}
                  context={{
                    marketPiqScore:
                      marketContext?.piq_score?.value ?? undefined,
                  }}
                  strategy={toEngineStrategy(activeStrategy) ?? "BUY_AND_HOLD"}
                  onApplyLever={analyzer.setInput}
                  {...upgradeProps}
                  onCustomizeClick={() => setDrawerOpen(true)}
                  presetLabel="Balanced"
                  aiProps={sectionAi.recommendation_analysis}
                />
              ) : grading.isLoading ? (
                <div
                  className="rounded-2xl border border-outline-variant bg-surface p-6 animate-pulse"
                  aria-busy="true"
                  role="status"
                >
                  <div className="h-24 w-24 rounded-xl bg-surface-container-high" />
                  <div className="mt-4 h-6 w-32 rounded bg-surface-container-high" />
                  <div className="mt-2 h-4 w-64 rounded bg-surface-container-high" />
                </div>
              ) : null}

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

              <RentcastBanners
                lookupErrorMsg={lookupErrorMsg}
                quotaExceeded={quotaExceeded}
                rentcastData={rentcastData}
                address={address}
              />

              <AnalyzerSections
                input={analyzer.input}
                rental={rental}
                flip={flip}
                brrrr={brrrr}
                projection={projection}
                afterTax={afterTax}
                arvLocal={arvLocal}
                rehabBudget={rehabBudget}
                activeStrategy={activeStrategy}
                marginalTaxRate={assumptions.marginalTaxRate}
                grossRentMonthly={grossRentMonthly}
                vacancyMonthly={vacancyMonthly}
                opexAnnual={opexAnnual}
                debtServiceMonthly={debtServiceMonthly}
                subjectLat={subjectLat}
                subjectLon={subjectLon}
                displayAddress={displayAddress}
                pricePerSqftValues={pricePerSqftValues}
                yourPricePerSqft={yourPricePerSqft}
                subjectPrice={subjectPrice}
                salesComps={salesComps}
                rentalComps={rentalComps}
                mapboxToken={mapboxToken}
                marketContext={marketContext}
                sectionAi={sectionAi}
                marketContextAi={{
                  aiPayloadBase: {
                    input: analyzer.input,
                    result: { rental, flip, brrrr },
                    rentcast: rentcastData,
                  },
                  aiEnabled: isPro && hasGradableInput,
                }}
              />
            </div>
          </div>
        </div>

        <EditInputsFab
          open={inputsOpenMobile}
          onToggle={() => setInputsOpenMobile((v) => !v)}
        >
          {inputPanel}
        </EditInputsFab>

        <CustomizeThresholdsDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          strategy={toEngineStrategy(activeStrategy) ?? "BUY_AND_HOLD"}
        />
      </main>
    </ModeProvider>
  );
}
