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
import { AdvisoriesStrip } from "./AdvisoriesStrip";
import { AutoKillBanner } from "./AutoKillBanner";
import { BrrrrUpgradePathPanel } from "./BrrrrUpgradePathPanel";
import { FlipUpgradePathPanel } from "./FlipUpgradePathPanel";
import { RecommendationCard } from "./RecommendationCard";
import { ScoreBreakdownTable } from "./ScoreBreakdownTable";
import { UpgradePathPanel } from "./UpgradePathPanel";
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
  onApplyFlipCombination,
  brrrrInput,
  brrrrContext,
  brrrrOverrideThresholds,
  onApplyBrrrrLever,
  onApplyBrrrrCombination,
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

  return (
    <div data-grading-result-panel className="space-y-4">
      <AutoKillBanner
        autoKills={result.autoKills}
        onEditCriteria={onEditAutoKillCriteria}
      />
      <RecommendationCard
        result={result}
        onCustomizeClick={onCustomizeClick}
        presetLabel={presetLabel}
        aiProps={aiProps}
      />
      <ScoreBreakdownTable
        metrics={result.metrics}
        rawGpa={result.rawGpa}
        marketAdjustment={result.marketAdjustment}
        finalGpa={result.finalGpa}
        finalLetter={result.letter}
      />
      {canRenderBnhUpgradePath && (
        <UpgradePathPanel
          input={input}
          context={context ?? {}}
          currentGrade={result.letter}
          strategy={strategy}
          onApply={onApplyLever}
          overrideThresholds={overrideThresholds}
        />
      )}
      {canRenderFlipUpgradePath && (
        <FlipUpgradePathPanel
          input={flipInput}
          context={flipContext}
          currentGrade={result.letter}
          onApplyFlipLever={onApplyFlipLever}
          overrideThresholds={flipOverrideThresholds}
        />
      )}
      {canRenderBrrrrUpgradePath && (
        <BrrrrUpgradePathPanel
          input={brrrrInput}
          context={brrrrContext}
          currentGrade={result.letter}
          onApplyBrrrrLever={onApplyBrrrrLever}
          overrideThresholds={brrrrOverrideThresholds}
        />
      )}
      <AdvisoriesStrip advisories={result.advisories} />
    </div>
  );
}
