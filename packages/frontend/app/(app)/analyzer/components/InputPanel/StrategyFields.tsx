"use client";
import { NumField } from "./NumField";
import { StrategyGroup } from "./StrategyGroup";
import type { AnalyzerAssumptions } from "../../lib/analyzer-assumptions";

interface StrategyFieldsProps {
  assumptions: AnalyzerAssumptions;
  onAssumptionChange: <K extends keyof AnalyzerAssumptions>(
    key: K,
    value: AnalyzerAssumptions[K],
  ) => void;
  showFlipGroup: boolean;
  showBrrrrGroup: boolean;
}

/**
 * Flip carry+exit and BRRRR refi+timeline field groups.
 * Rendered only when the active strategy or compare mode calls for them.
 * Extracted from InputPanel to keep that file under the 400-line hard limit.
 */
export function StrategyFields({
  assumptions,
  onAssumptionChange,
  showFlipGroup,
  showBrrrrGroup,
}: StrategyFieldsProps) {
  return (
    <>
      {showFlipGroup && (
        <StrategyGroup label="Flip carry & exit" chip="FLIP">
          <NumField
            label="Holding months"
            value={assumptions.holdingMonths}
            onChange={(v) => onAssumptionChange("holdingMonths", v ?? 0)}
            placeholder="4"
          />
          <NumField
            label="Selling costs"
            value={Math.round(assumptions.sellingCostsPct * 1000) / 10}
            onChange={(v) =>
              onAssumptionChange("sellingCostsPct", v == null ? 0 : v / 100)
            }
            suffix="%"
            placeholder="7.0"
          />
        </StrategyGroup>
      )}

      {showBrrrrGroup && (
        <StrategyGroup label="BRRRR refi & timeline" chip="BRRRR">
          <NumField
            label="Refi LTV"
            value={Math.round(assumptions.refinanceLTVPct * 1000) / 10}
            onChange={(v) =>
              onAssumptionChange("refinanceLTVPct", v == null ? 0 : v / 100)
            }
            suffix="%"
            placeholder="75"
          />
          <NumField
            label="Seasoning months"
            value={assumptions.seasoningMonths}
            onChange={(v) => onAssumptionChange("seasoningMonths", v ?? 0)}
            placeholder="6"
          />
          <NumField
            label="Rehab months"
            value={assumptions.rehabMonths}
            onChange={(v) => onAssumptionChange("rehabMonths", v ?? 0)}
            placeholder="3"
          />
          <NumField
            label="Lease-up months"
            value={assumptions.leaseMonths}
            onChange={(v) => onAssumptionChange("leaseMonths", v ?? 0)}
            placeholder="1"
          />
        </StrategyGroup>
      )}
    </>
  );
}
