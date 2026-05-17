"use client";

import { piq } from "../primitives/piqTokens";
import { STRATEGY_LABEL, type Strategy } from "../../lib/strategy-tile-mappers";

interface StrategyChipsProps {
  active: Strategy;
  onChange: (s: Strategy) => void;
  className?: string;
}

// Multifamily is a property TYPE (selected via the SFH/MF toggle at the top
// of InputPanel), not a strategy. The three real investment strategies are:
const ORDER: Strategy[] = ["buyAndHold", "flip", "brrrr"];

export function StrategyChips({
  active,
  onChange,
  className = "",
}: StrategyChipsProps) {
  return (
    <div
      role="tablist"
      aria-label="Investment strategy"
      className={`flex items-center gap-2 flex-wrap ${className}`}
    >
      {ORDER.map((s) => {
        const isActive = s === active;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(s)}
            className="inline-flex items-center gap-1.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{
              padding: "7px 14px",
              fontSize: "13px",
              fontWeight: 500,
              background: isActive ? piq.indigo : "transparent",
              color: isActive ? "#FFFFFF" : piq.textPrimary,
              border: `0.5px solid ${isActive ? piq.indigo : piq.border}`,
              cursor: "pointer",
              letterSpacing: "0.01em",
            }}
          >
            {STRATEGY_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}
