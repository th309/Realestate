"use client";

import { use, useState } from "react";
import { useEntitlements } from "@/lib/entitlements";
import { AnalyzerHeader } from "./components/chrome/AnalyzerHeader";
import { StrategyCompare } from "./components/StrategyCompare/StrategyCompare";
import { AnalyzerInputPanel } from "./components/InputPanel/AnalyzerInputPanel";
import { AnalyzerOverlays } from "./components/chrome/AnalyzerOverlays";
import { AnalyzerEmptyState } from "./components/chrome/AnalyzerEmptyState";
import { EditInputsBar } from "./components/chrome/EditInputsBar";
import { useAnalyzerState } from "./lib/use-analyzer-state";
import { buildStrategyCompareProps } from "./lib/strategy-compare-builders";
import { GradingBlock } from "./components/cards/GradingBlock";
import { AdvisoriesStrip } from "./components/cards/AdvisoriesStrip";
import { AnalyzerSections } from "./components/AnalyzerSections";
import { toEngineStrategy } from "./lib/use-grading-result";
import { useAnalyzerDefaultsPrefill } from "./lib/use-analyzer-defaults-prefill";
import { StrategyKPI } from "./components/Hero/StrategyKPI";
import { JumpBar } from "@/app/components/app-shell";
import { getJumpItems } from "./lib/jump-items";
import { MarketScoreStrip } from "./components/MarketScoreStrip";
import { PropertyImagery } from "./components/PropertyImagery";
import { StaleDealNotice } from "./components/cards/StaleDealNotice";
import { useCurrentDealState } from "./lib/use-current-deal-state";
import type { DealStateV2 } from "./lib/deal-state-types";
import type { MarketContext } from "@/lib/data/fetchers/analyzer";
import { AnalyzerSidebar } from "./components/chrome/AnalyzerSidebar";
import { SavedAnalysesPanel } from "./components/SavedAnalysesPanel";
import { RentcastBanners } from "./components/RentcastBanners";
import { useSelectedGoal } from "./lib/use-selected-goal";
import { useAnalyzerNotes } from "./lib/use-analyzer-notes";
import { useAnalyzerChrome } from "./lib/use-analyzer-chrome";
import { GoalPicker } from "./components/StrategyCompare/GoalPicker";
import { useAnalyzerAnalysis } from "./lib/use-analyzer-analysis";
import { useSubjectCoordinates } from "./lib/use-subject-coordinates";
import {
  deriveDealReadout,
  useAnalyzerViewModel,
} from "./lib/use-analyzer-view-model";
import { STRATEGY_LABEL, type Strategy } from "./lib/strategy-tile-mappers";
import type { AnalysisMode } from "./components/InputPanel/StrategyControls";

export default function AnalyzerClient({
  searchParamsPromise,
  dealId: savedDealId,
  initialState,
  initialMarketContext,
}: {
  searchParamsPromise: Promise<{
    address?: string;
    zip?: string;
  }>;
  /** Set when resuming a saved deal — turns on autosave. See SavedDealLoader. */
  dealId?: string;
  initialState?: DealStateV2;
  /** The saved row's `market_context`, restored rather than refetched (§4.4). */
  initialMarketContext?: MarketContext | null;
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
    initialState,
    initialMarketContext,
  });
  // Null until the first deliberate save materializes a row (onSaved).
  const [dealId, setDealId] = useState<string | null>(savedDealId ?? null);
  // prettier-ignore
  const {
    analyzer, address, arvLocal, rehabBudget, assumptions, setAssumption,
    propertyLookup, rentcastData, quotaExceeded, projection, afterTax,
    breakEven, brrrrTimeline, marketContext, piqByGeo, prefill,
  } = state;
  const { rental, flip, brrrr } = analyzer;

  const chrome = useAnalyzerChrome();
  // Seeded from the saved deal or autosave writes "" straight over the saved
  // notes on open — permanent data loss, no user action required.
  const notesState = useAnalyzerNotes({
    notes: initialState?.notes,
    shareNotes: initialState?.shareNotes,
  });
  const { hasGradableInput, verdict } = deriveDealReadout(
    analyzer.input,
    rental,
    marketContext?.piq_score?.value ?? null,
  );

  // MarketContextSection fires its own three per-geo market-context queries
  // (useMarketContextByGeo) keyed off `chain` — a THIRD call site of the same
  // queries usePiqByGeo and useAnalyzerState already gate. Withholding the
  // chain while a saved deal shows restored data disables all three; every
  // value then falls through to that section's `fallback*` props, which are
  // fed from this same restored context. Interim: the section's own
  // `marketDataEnabled` prop is the honest seam, but `AnalyzerSections` sits
  // between us and is owned elsewhere. Cost until it is threaded — the
  // metro/county/ZIP pills are hidden until the user refreshes.
  const sectionsMarketContext =
    state.marketDataEnabled || !marketContext
      ? marketContext
      : { ...marketContext, chain: null };

  // Per-deal UI state, so a resumed deal reopens in the mode it was left in.
  // The investor GOAL below is deliberately NOT restored — spec §4.6.
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(
    initialState?.analysisMode ?? "focused",
  );
  // prettier-ignore
  const { selectedGoal, activeGoal, setSelectedGoal, bestPlay, noGoalFit } = useSelectedGoal(
    analyzer, projection, assumptions, analysisMode, hasGradableInput,
  );
  const [focusedStrategy, setFocusedStrategy] = useState<Strategy>(bestPlay);

  useAnalyzerDefaultsPrefill({
    setInput: analyzer.setInput,
    setAssumption,
    currentInput: analyzer.input,
    // A resumed deal already holds the values the user tuned for it; the
    // global defaults must not overwrite them on open — see the hook.
    enabled: !state.isHydrated,
  });
  const vm = useAnalyzerViewModel({
    analysisMode,
    bestPlay,
    focusedStrategy,
    resolvedAddress: rentcastData?.resolved_address,
    address,
    rentcastData,
    prefillParcel: prefill.data?.parcel ?? null,
    price: analyzer.input.price ?? 0,
    input: analyzer.input,
    rental,
    lookupError: propertyLookup.error,
  });
  const {
    activeStrategy,
    presetLabel,
    savedThresholds,
    displayAddress,
    compsView,
    lookupErrorMsg,
  } = vm;

  const { subjectLat, subjectLon } = useSubjectCoordinates(
    compsView.subjectLat,
    compsView.subjectLon,
    displayAddress,
  );

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

  const { grading, upgradeProps, sectionAi } = useAnalyzerAnalysis({
    state,
    isPro,
    activeStrategy,
    hasGradableInput,
    activeGoal,
  });

  const deal = useCurrentDealState({
    state,
    initialState,
    dealId,
    isPro,
    analysisMode,
    activeGoal,
    thresholds: presetLabel === "Custom" ? savedThresholds : undefined,
    notes: notesState.notes,
    shareNotes: notesState.shareNotes,
  });

  const inputPanel = (
    <AnalyzerInputPanel
      state={state}
      isPro={isPro}
      activeStrategy={activeStrategy}
      analysisMode={analysisMode}
      onAnalysisModeChange={setAnalysisMode}
      onStrategyChange={setFocusedStrategy}
      onCustomizeClick={() => chrome.openDrawer("assumptions")}
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
          dealId={dealId}
          dealState={deal.dealState}
          label={deal.label}
          onLabelChange={deal.setLabel}
          saveStatus={deal.saveStatus}
          onSaved={setDealId}
          onSaveClick={deal.saveStatus === "error" ? deal.retrySave : undefined}
        />

        {displayAddress && <MarketScoreStrip piqByGeo={piqByGeo} />}

        <StaleDealNotice
          marketCapturedAt={state.isHydrated ? deal.marketCapturedAt : null}
          onRefresh={deal.refreshMarketData}
          isRefreshing={deal.isRefreshingMarket}
        />

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
            {hasGradableInput && <EditInputsBar onClick={chrome.openInputs} />}

            <RentcastBanners
              lookupErrorMsg={lookupErrorMsg}
              quotaExceeded={quotaExceeded}
              rentcastData={rentcastData}
              address={address}
            />

            {/* Replaces the em-dash KPI row and $0 chart that used to render
                pre-input; absorbs the start CTA for the sheet. */}
            {!hasGradableInput && (
              <AnalyzerEmptyState onStart={chrome.openInputs} />
            )}

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

            {/* No address guard: the panel self-guards on coordinates, and
                gating on displayAddress would suppress imagery whenever a
                lookup returns coordinates without a resolved_address. */}
            <PropertyImagery
              lat={subjectLat}
              lon={subjectLon}
              address={displayAddress ?? ""}
            />

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
              onCustomizeClick={() => chrome.openDrawer("thresholds")}
              onEditAutoKillCriteria={() => chrome.openDrawer("autokill")}
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

            {/* vm.cashflow and compsView are spread whole: both are props
                objects built for this component by deriveCashflowSummary /
                buildCompsViewProps. */}
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
                {...vm.cashflow}
                {...compsView}
                subjectLat={subjectLat}
                subjectLon={subjectLon}
                displayAddress={displayAddress}
                marketContext={sectionsMarketContext}
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

      <AnalyzerOverlays
        chrome={chrome}
        strategy={toEngineStrategy(activeStrategy) ?? "BUY_AND_HOLD"}
        inputPanel={inputPanel}
      />
    </main>
  );
}
