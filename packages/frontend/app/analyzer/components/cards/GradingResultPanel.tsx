"use client";

import type {
  DealGradingResult,
  DealInput,
  GradingContext,
  Strategy,
  UserThresholds,
} from "@propertyiq/analyzer-core";
import { AdvisoriesStrip } from "./AdvisoriesStrip";
import { AutoKillBanner } from "./AutoKillBanner";
import { RecommendationCard } from "./RecommendationCard";
import { ScoreBreakdownTable } from "./ScoreBreakdownTable";
import { UpgradePathPanel } from "./UpgradePathPanel";

interface GradingResultPanelProps {
  result: DealGradingResult;
  /** Required when the upgrade-path panel should be wired. */
  input?: DealInput;
  context?: GradingContext;
  strategy?: Strategy;
  overrideThresholds?: UserThresholds;
  /** "Apply to inputs" handler — receives the next DealInput. */
  onApplyLever?: (next: DealInput) => void;
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
  onCustomizeClick,
  presetLabel,
}: GradingResultPanelProps) {
  const canRenderUpgradePath =
    result.letter !== "A" && input && strategy && onApplyLever;
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
      {canRenderUpgradePath && (
        <UpgradePathPanel
          input={input}
          context={context ?? {}}
          currentGrade={result.letter}
          strategy={strategy}
          onApply={onApplyLever}
          overrideThresholds={overrideThresholds}
        />
      )}
      <AdvisoriesStrip advisories={result.advisories} />
    </div>
  );
}
