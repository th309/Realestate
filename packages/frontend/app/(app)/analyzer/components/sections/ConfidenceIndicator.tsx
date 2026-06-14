"use client";

import { piq } from "../primitives/piqTokens";
import type { ConfidenceTier } from "../../lib/sensitivity-impacts";

interface ConfidenceIndicatorProps {
  tier: ConfidenceTier;
  description: string;
  className?: string;
}

const TIER_LABEL: Record<ConfidenceTier, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function tierColor(tier: ConfidenceTier): string {
  if (tier === "high") return piq.green;
  if (tier === "medium") return piq.amber;
  return piq.red;
}

function tierFilledSegments(tier: ConfidenceTier): number {
  if (tier === "high") return 3;
  if (tier === "medium") return 2;
  return 1;
}

/**
 * Battery-style data-confidence indicator. Three segments fill from left in
 * the tier's accent color; unfilled segments stay neutral border-gray. Sits
 * inline with the sensitivity headline so the user can read "deal-level
 * uncertainty + data-quality" together at a glance.
 */
export function ConfidenceIndicator({
  tier,
  description,
  className = "",
}: ConfidenceIndicatorProps) {
  const color = tierColor(tier);
  const filled = tierFilledSegments(tier);

  return (
    <div
      className={`flex flex-col gap-1.5 ${className}`}
      data-confidence={tier}
    >
      <div
        style={{
          fontSize: "11px",
          color: piq.textMuted,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Data confidence
      </div>
      <div className="flex items-center gap-3">
        <div
          className="flex gap-1"
          role="img"
          aria-label={`Confidence: ${TIER_LABEL[tier]}`}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 28,
                height: 6,
                borderRadius: 3,
                background: i < filled ? color : piq.border,
                transition: "background 200ms ease",
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color,
            letterSpacing: "-0.005em",
          }}
        >
          {TIER_LABEL[tier]}
        </div>
      </div>
      <div
        style={{
          fontSize: "11px",
          color: piq.textMuted,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {description}
      </div>
    </div>
  );
}
