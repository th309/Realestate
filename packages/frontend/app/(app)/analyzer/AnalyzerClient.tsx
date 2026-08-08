"use client";

import { use, useState } from "react";
import { useEntitlements } from "@/lib/entitlements";
import { AnalyzerHeader } from "./components/chrome/AnalyzerHeader";
import { StrategyCompare } from "./components/StrategyCompare/StrategyCompare";
import { AnalyzerInputPanel } from "./components/InputPanel/AnalyzerInputPanel";
import { MobileInputSheet } from "./components/chrome/MobileInputSheet";
import { AnalyzerEmptyState } from "./components/chrome/AnalyzerEmptyState";
import { EditInputsBar } from "./components/chrome/EditInputsBar";
import { useAnalyzerState } from "./lib/use-analyzer-state";
import { buildStrategyCompareProps } from "./lib/strategy-compare-builders";
import { deriveVerdict } from "./lib/format-helpers";
import { GradingBlock } from "./components/cards/GradingBlock";
import { AdvisoriesStrip } from "./components/cards/AdvisoriesStrip";
import { AnalyzerSections } from "./components/AnalyzerSections";
import { CustomizeThresholdsDrawer } from "./components/CustomizeThresholdsDrawer/CustomizeThresholdsDrawer";
import type { ThresholdsTabId } from "./components/CustomizeThresholdsDrawer/useDrawerState";
import { toEngineStrategy, useGradingResult } from "./lib/use-grading-result";
import { useAnalyzerDefaultsPrefill } from "./lib/use-analyzer-defaults-prefill";
import { StrategyKPI } from "./components/Hero/StrategyKPI";
import { JumpBar } from "@/app/components/app-shell";
import { getJumpItems } from "./lib/jump-items";
import { MarketScoreStrip } from "./components/MarketScoreStrip";
import { AnalyzerSidebar } from "./components/chrome/AnalyzerSidebar";
import { SavedAnalysesPanel } from "./components/SavedAnalysesPanel";
import { RentcastBanners } from "./components/RentcastBanners";
import { useSelectedGoal } from "./lib/use-selected-goal";
import { useAnalyzerNotes } from "./lib/use-analyzer-notes";
import { useMobileInputFocus } from "./lib/use-mobile-input-focus";
import { GoalPicker } from "./components/StrategyCompare/GoalPicker";
import { useUpgradeProps } from "./lib/use-upgrade-props";
import { useSectionAiInsights } from "./lib/use-section-ai-insights";
import { useAnalyzerViewModel } from "./lib/use-analyzer-view-model";
import { STRATEGY_LABEL, type Strategy } from "./lib/strategy-tile-mappers";
import type { AnalysisMode } from "./components/InputPanel/StrategyControls";

export default function AnalyzerClient({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{
    address?: string;
    zip?: string;
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
    analyzer, address, arvLocal, setArvLocal, rehabBudget,
    setRehabBudget, assumptions, setAssumption, propertyLookup, rentcastData,
    quotaExceeded, projection, afterTax, breakEven, brrrrTimeline,
    marketContext, piqByGeo, piqByGeoResolving,
  } = state;
  const { rental, flip, brrrr } = analyzer;

  const [inputsOpenMobile, setInputsOpenMobile] = useState(false);
  const notesState = useAnalyzerNotes();

  const verdict = deriveVerdict({
    capRatePct: rental.capRatePct,
    dscr: rental.dscr,
    cashflowMonthly: rental.cashflowMonthly,
    piqScore: marketContext?.piq_score?.value ?? null,
  });

  const hasGradableInput =
    (analyzer.input.price ?? 0) > 0 &&
    ((analyzer.input.rentMonthly ?? 0) > 0 || rental.capRatePct != null);

  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("focused");
  // prettier-ignore
  const { selectedGoal, activeGoal, setSelectedGoal, bestPlay, noGoalFit } = useSelectedGoal(
    analyzer, projection, assumptions, analysisMode, hasGradableInput,
  );
  const [focusedStrategy, setFocusedStrategy] = useState<Strategy>(bestPlay);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<ThresholdsTabId>("thresholds");
  const openDrawer = (tab: ThresholdsTabId) => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  };

  useAnalyzerDefaultsPrefill({
    setInput: analyzer.setInput,
    setAssumption,
    currentInput: analyzer.input,
  });
  const vm = useAnalyzerViewModel({
    analysisMode,
    bestPlay,
    focusedStrategy,
    resolvedAddress: rentcastData?.resolved_address,
    address,
    rentcastData,
    price: analyzer.input.price ?? 0,
    input: analyzer.input,
    rental,
    lookupError: propertyLookup.error,
  });
  const {
    activeStrategy,
    presetLabel,
    displayAddress,
    compsView,
    lookupErrorMsg,
  } = vm;
  const { grossRentMonthly, debtServiceMonthly, opexAnnual, vacancyMonthly } =
    vm.cashflow;
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

  // Single entry point for property input on mobile: open the sheet. Focus
  // management on open lives in useMobileInputFocus.
  const openInputs = () => setInputsOpenMobile(true);
  useMobileInputFocus(inputsOpenMobile);

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
    enabled: isPro && hasGradableInput && !piqByGeoResolving, // see usePiqByGeo.isResolving
    input: analyzer.input,
    rental,
    flip,
    brrrr,
    rentcast: rentcastData,
    piq: marketContext,
    grading: grading.data ?? null,
    strategy: toEngineStrategy(activeStrategy) ?? null,
    piqByGeo,
    goal: activeGoal,
    projection,
  });

  const inputPanel = (
    <AnalyzerInputPanel
      state={state}
      isPro={isPro}
      activeStrategy={activeStrategy}
      analysisMode={analysisMode}
      onAnalysisModeChange={setAnalysisMode}
      onStrategyChange={setFocusedStrategy}
      onCustomizeClick={() => openDrawer("assumptions")}
    />
  );

  return (
    // `data-piq-theme` maps the M3 neutrals onto the piq palette for this
    // subtree so shared shells restyle with it — see globals.css.
    <main data-piq-theme className="min-h-screen bg-piq-canvas">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-6">
        <AnalyzerHeader
          isPro={isPro}
          headingLabel={displayAddress ?? "analysis"}
          state={state}
          grading={grading}
          compsView={compsView}
          activeStrategy={activeStrategy}
          activeEngineStrategy={toEngineStrategy(activeStrategy) ?? null}
          selectedGoal={activeGoal}
          displayAddress={displayAddress}
          paramZip={params.zip}
          notes={notesState.notes}
          shareNotes={notesState.shareNotes}
          onRegisterSave={notesState.registerSave}
          strategyLabel={STRATEGY_LABEL[activeStrategy]}
        />

        {displayAddress && <MarketScoreStrip piqByGeo={piqByGeo} />}

        {/* Spec: `344px minmax(0, 1fr)` above 1140px, single column below. The
            input column is a fixed 344px, not a fraction — that width is what
            the panel's two-up field grid is designed against. Cells stretch
            rather than start-align, so the sidebar can stick — see
            AnalyzerSidebar. */}
        <div className="grid grid-cols-1 gap-4 min-[1140px]:grid-cols-[344px_minmax(0,1fr)]">
          <AnalyzerSidebar
            inputPanel={inputPanel}
            propertyRecord={rentcastData?.property_record}
          />

          <div className="space-y-6 min-w-0">
            {hasGradableInput && (
              <JumpBar
                items={getJumpItems(!!grading.data)}
                activeId={grading.data ? "verdict" : "cashflow"}
              />
            )}
            <SavedAnalysesPanel />
            {hasGradableInput && <EditInputsBar onClick={openInputs} />}

            <RentcastBanners
              lookupErrorMsg={lookupErrorMsg}
              quotaExceeded={quotaExceeded}
              rentcastData={rentcastData}
              address={address}
            />

            {/* Replaces the em-dash KPI row and $0 chart that used to render
                pre-input; absorbs the start CTA for the sheet. */}
            {!hasGradableInput && <AnalyzerEmptyState onStart={openInputs} />}

            {hasGradableInput && analysisMode === "compare" && (
              <GoalPicker
                selectedGoal={selectedGoal}
                onChange={setSelectedGoal}
              />
            )}

            {hasGradableInput && analysisMode === "compare" && (
              <StrategyCompare
                {...strategyProps}
                isDealViable={verdict !== "bad" && verdict !== "avoid"}
                selectedGoal={selectedGoal}
                winner={bestPlay}
                noGoalFit={noGoalFit}
              />
            )}

            <GradingBlock
              result={grading.data}
              isLoading={grading.isLoading}
              input={analyzer.input}
              context={{
                marketPiqScore: marketContext?.piq_score?.value ?? undefined,
              }}
              strategy={toEngineStrategy(activeStrategy) ?? "BUY_AND_HOLD"}
              onApplyLever={analyzer.setInput}
              {...upgradeProps}
              onCustomizeClick={() => openDrawer("thresholds")}
              onEditAutoKillCriteria={() => openDrawer("autokill")}
              presetLabel={presetLabel}
              aiProps={sectionAi.recommendation_analysis}
            />

            {/* Mockup order: verdict → rules → KPIs. These read as a
                pre-flight check on the KPI row beneath them, so they sit
                here rather than buried at the foot of the grading panel. */}
            {grading.data && (
              <AdvisoriesStrip advisories={grading.data.advisories} />
            )}

            {hasGradableInput && (
              <div id="cashflow" className="scroll-mt-20">
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
              </div>
            )}

            {hasGradableInput && (
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
                notes={notesState.notes}
                shareNotes={notesState.shareNotes}
                onNotesChange={notesState.onNotesChange}
                onSaveNotes={notesState.saveNotes}
              />
            )}
          </div>
        </div>
      </div>

      <MobileInputSheet
        open={inputsOpenMobile}
        onClose={() => setInputsOpenMobile(false)}
      >
        {inputPanel}
      </MobileInputSheet>

      <CustomizeThresholdsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        strategy={toEngineStrategy(activeStrategy) ?? "BUY_AND_HOLD"}
        initialTab={drawerTab}
      />
    </main>
  );
}
