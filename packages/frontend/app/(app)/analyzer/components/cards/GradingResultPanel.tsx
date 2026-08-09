"use client";

import type {
  BrrrrThresholds,
  BrrrrUpgradeOption,
  DealGradingResult,
  DealInput,
  FixAndFlipThresholds,
  FlipUpgradeOption,
  GradingContext,
  Strategy,
  UserThresholds,
} from "@propertyiq/analyzer-core";
import type {
  UpgradePathBrrrrRequest,
  UpgradePathFlipRequest,
} from "@/lib/data";
import { AutoKillBanner } from "./AutoKillBanner";
import { BrrrrUpgradePathPanel } from "./BrrrrUpgradePathPanel";
import { FlipUpgradePathPanel } from "./FlipUpgradePathPanel";
import { RecommendationCard } from "./RecommendationCard";
import { ScoreBreakdownTable } from "./ScoreBreakdownTable";
import { UpgradePathPanel } from "./UpgradePathPanel";
import { JUMP_TARGET_SCROLL_MARGIN } from "../../lib/jump-items";
import type { SectionAiProps } from "../../lib/use-section-ai-insights";

interface GradingResultPanelProps {
  result: DealGradingResult;
  /** B&H: DealInput for the upgrade-path panel. */
  input?: DealInput;
  context?: GradingContext;
  strategy?: Strategy;
  overrideThresholds?: UserThresholds;
  /** B&H: "Apply to inputs" handler — receives the next DealInput. */
  onApplyLever?: (next: DealInput) => void;

  /** F&F: API-shape flip input for the F&F upgrade-path panel. */
  flipInput?: UpgradePathFlipRequest["input"];
  flipContext?: UpgradePathFlipRequest["context"];
  flipOverrideThresholds?: FixAndFlipThresholds;
  /** F&F: lever-apply handler — parent maps each lever to the right setter. */
  onApplyFlipLever?: (option: FlipUpgradeOption) => void;
  /** F&F: combination-hint apply handler. */
  onApplyFlipCombination?: (combo: {
    priceDelta: number;
    rehabDelta: number;
  }) => void;

  /** BRRRR: API-shape BRRRR input for the BRRRR upgrade-path panel. */
  brrrrInput?: UpgradePathBrrrrRequest["input"];
  brrrrContext?: UpgradePathBrrrrRequest["context"];
  brrrrOverrideThresholds?: BrrrrThresholds;
  /** BRRRR: lever-apply handler — parent maps each lever to the right setter. */
  onApplyBrrrrLever?: (option: BrrrrUpgradeOption) => void;
  /** BRRRR: combination-hint apply handler (price reduction + rent boost). */
  onApplyBrrrrCombination?: (combo: {
    priceDelta: number;
    rentDelta: number;
  }) => void;

  /** Opens the Customize Thresholds drawer. Renders the chip when provided. */
  onCustomizeClick?: () => void;
  /** Opens the Auto-Kill tab of the Customize drawer from the banner. */
  onEditAutoKillCriteria?: () => void;
  /** Display name shown in the customize chip (e.g. "Balanced"). */
  presetLabel?: string;
  /** Per-deal AI analysis from `useSectionAiInsights().recommendation_analysis`.
   *  When provided and either `aiText` is non-empty OR `aiIsLoading` is true,
   *  a 3-5 sentence narrative renders directly under the RecommendationCard
   *  explaining the grade, the biggest improvement lever, and how the PIQ
   *  score frames this market. Omit on saved/shared routes. */
  aiProps?: SectionAiProps;
}

export function GradingResultPanel({
  result,
  input,
  context,
  strategy,
  overrideThresholds,
  onApplyLever,
  flipInput,
  flipContext,
  flipOverrideThresholds,
  onApplyFlipLever,
  brrrrInput,
  brrrrContext,
  brrrrOverrideThresholds,
  onApplyBrrrrLever,
  onCustomizeClick,
  onEditAutoKillCriteria,
  presetLabel,
  aiProps,
}: GradingResultPanelProps) {
  // B&H upgrade-path renders only when strategy is BUY_AND_HOLD + B&H args
  // are wired. F&F and BRRRR have their own panels.
  const canRenderBnhUpgradePath =
    result.letter !== "A" &&
    input &&
    strategy === "BUY_AND_HOLD" &&
    onApplyLever;

  const canRenderFlipUpgradePath =
    result.letter !== "A" &&
    flipInput &&
    strategy === "FIX_AND_FLIP" &&
    onApplyFlipLever;

  const canRenderBrrrrUpgradePath =
    result.letter !== "A" &&
    brrrrInput &&
    strategy === "BRRRR" &&
    onApplyBrrrrLever;

  // Exactly one upgrade-path panel can apply at a time — the three guards are
  // mutually exclusive on `strategy`. Resolving it to a single node lets the
  // grading table pair with it two-up, and fall back to full width for an
  // A-grade deal, which has no levers left to pull.
  const leverPanel = canRenderBnhUpgradePath ? (
    <UpgradePathPanel
      input={input}
      context={context ?? {}}
      currentGrade={result.letter}
      strategy={strategy}
      onApply={onApplyLever}
      overrideThresholds={overrideThresholds}
    />
  ) : canRenderFlipUpgradePath ? (
    <FlipUpgradePathPanel
      input={flipInput}
      context={flipContext}
      currentGrade={result.letter}
      onApplyFlipLever={onApplyFlipLever}
      overrideThresholds={flipOverrideThresholds}
    />
  ) : canRenderBrrrrUpgradePath ? (
    <BrrrrUpgradePathPanel
      input={brrrrInput}
      context={brrrrContext}
      currentGrade={result.letter}
      onApplyBrrrrLever={onApplyBrrrrLever}
      overrideThresholds={brrrrOverrideThresholds}
    />
  ) : null;

  const scoreTable = (
    <ScoreBreakdownTable
      metrics={result.metrics}
      rawGpa={result.rawGpa}
      marketAdjustment={result.marketAdjustment}
      finalGpa={result.finalGpa}
      finalLetter={result.letter}
      presetLabel={presetLabel}
    />
  );

  return (
    <div data-grading-result-panel className="space-y-4">
      <AutoKillBanner
        autoKills={result.autoKills}
        onEditCriteria={onEditAutoKillCriteria}
      />
      <div id="verdict" className={JUMP_TARGET_SCROLL_MARGIN}>
        <RecommendationCard
          result={result}
          onCustomizeClick={onCustomizeClick}
          presetLabel={presetLabel}
          aiProps={aiProps}
        />
      </div>
      {leverPanel ? (
        <div className="grid grid-cols-1 items-start gap-4 min-[1240px]:grid-cols-2">
          {/*
            The mockup pairs these at similar heights, but the real engine
            emits one lever per failing metric — measured 399px of table
            against 1136px of levers, which left ~740px of dead column. The
            table sticks instead, so the grade breakdown stays on screen while
            you read the levers that move it.

            It pins below the sticky chrome, not at the top of the viewport:
            `--app-chrome-h` (the AppBar + breadcrumbs height, defined in
            app/globals.css) plus the analyzer's own jump bar already hold the
            top of the screen. That is the same offset the jump targets reserve,
            so the table settles exactly where a jump link would land it — see
            JUMP_BAR_STICKY and JUMP_TARGET_SCROLL_MARGIN in lib/jump-items.
          */}
          <div
            id="grading"
            className={`min-w-0 ${JUMP_TARGET_SCROLL_MARGIN} min-[1240px]:sticky min-[1240px]:top-[calc(var(--app-chrome-h)_+_76px)]`}
          >
            {scoreTable}
          </div>
          <div id="improve" className={`min-w-0 ${JUMP_TARGET_SCROLL_MARGIN}`}>
            {leverPanel}
          </div>
        </div>
      ) : (
        <div id="grading" className={JUMP_TARGET_SCROLL_MARGIN}>
          {scoreTable}
        </div>
      )}
    </div>
  );
}
