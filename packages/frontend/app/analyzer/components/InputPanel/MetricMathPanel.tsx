"use client";

/**
 * Collapsible "How the metrics are calculated" panel that sits in the input
 * column, right below the price/tax/insurance fields. Shows the underwriting
 * waterfall (gross rent → vacancy → opex → NOI → debt service → cash flow)
 * plus the derived metrics with their actual numbers plugged in.
 *
 * Strategy-aware: each strategy's math lives in its own file
 * (BuyAndHoldMath, FlipMath, BrrrrMath) so this file stays an orchestrator.
 * Shared layout primitives (MathSection / Row / Total) and formatters live
 * in MetricMathPrimitives.
 *
 * Defaults to closed so it doesn't dominate the input panel. Users who want
 * to verify the math expand it; everyone else sees a one-line teaser.
 */

import { useState } from "react";
import type {
  BrrrrResult,
  DealInput,
  FlipResult,
  RentalResult,
} from "@propertyiq/analyzer-core";
import type { Strategy } from "../../lib/strategy-tile-mappers";
import type { AnalyzerAssumptions } from "../../lib/analyzer-assumptions";
import { BuyAndHoldMath } from "./BuyAndHoldMath";
import { FlipMath } from "./FlipMath";
import { BrrrrMath } from "./BrrrrMath";

interface MetricMathPanelProps {
  input: DealInput;
  rental: RentalResult | null | undefined;
  flip: FlipResult | null | undefined;
  brrrr: BrrrrResult | null | undefined;
  activeStrategy: Strategy;
  arvLocal: number;
  rehabBudget: number;
  assumptions: AnalyzerAssumptions | undefined;
}

export function MetricMathPanel({
  input,
  rental,
  flip,
  brrrr,
  activeStrategy,
  arvLocal,
  rehabBudget,
  assumptions,
}: MetricMathPanelProps) {
  const [open, setOpen] = useState(false);

  if ((input.price ?? 0) <= 0) return null;

  return (
    <div className="border-t border-outline-variant pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center justify-between w-full text-xs uppercase font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <span>How the metrics are calculated</span>
        <span aria-hidden className="text-on-surface-variant">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div
          data-metric-math
          className="mt-3 space-y-4 text-[12px] leading-relaxed"
          style={{ fontFamily: "var(--font-roboto-mono)" }}
        >
          {activeStrategy === "buyAndHold" && rental && (
            <BuyAndHoldMath input={input} rental={rental} />
          )}
          {activeStrategy === "flip" && flip && (
            <FlipMath
              input={input}
              flip={flip}
              arvLocal={arvLocal}
              rehabBudget={rehabBudget}
              assumptions={assumptions}
            />
          )}
          {activeStrategy === "brrrr" && brrrr && (
            <BrrrrMath
              input={input}
              brrrr={brrrr}
              rental={rental ?? null}
              arvLocal={arvLocal}
              rehabBudget={rehabBudget}
              assumptions={assumptions}
            />
          )}
        </div>
      )}
    </div>
  );
}
