"use client";

import type {
  DealGradingResult,
  DealInput,
  FixAndFlipThresholds,
  FlipUpgradeOption,
  GradingContext,
  Strategy,
  UserThresholds,
} from "@propertyiq/analyzer-core";
import type { UpgradePathFlipRequest } from "@/lib/data";
import { AdvisoriesStrip } from "./AdvisoriesStrip";
import { AutoKillBanner } from "./AutoKillBanner";
import { FlipUpgradePathPanel } from "./FlipUpgradePathPanel";
import { RecommendationCard } from "./RecommendationCard";
import { ScoreBreakdownTable } from "./ScoreBreakdownTable";
import { UpgradePathPanel } from "./UpgradePathPanel";

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

  /** Opens the Customize Thresholds drawer. Renders the chip when provided. */
  onCustomizeClick?: () => void;
  /** Display name shown in the customize chip (e.g. "Balanced"). */
  presetLabel?: string;
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
  onCustomizeClick,
  presetLabel,
}: GradingResultPanelProps) {
  // B&H upgrade-path renders only when strategy is BUY_AND_HOLD + B&H args
  // are wired. F&F has its own panel that hits /upgrade-path-flip.
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

  return (
    <div data-grading-result-panel className="space-y-4">
      <AutoKillBanner autoKills={result.autoKills} />
      <RecommendationCard
        result={result}
        onCustomizeClick={onCustomizeClick}
        presetLabel={presetLabel}
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
          onApplyFlipCombination={onApplyFlipCombination}
          overrideThresholds={flipOverrideThresholds}
        />
      )}
      <AdvisoriesStrip advisories={result.advisories} />
    </div>
  );
}
