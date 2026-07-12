"use client";

import React from "react";
import { Building2 } from "lucide-react";
import type { ScreenerGeoLevel } from "@/lib/data";
import { MARKET_SIZE_FLOOR } from "../lib/market-size";

interface MarketSizeToggleProps {
  geo: ScreenerGeoLevel;
  hideSmallMarkets: boolean;
  onChange: (hideSmallMarkets: boolean) => void;
}

const formatPop = (n: number) =>
  n >= 1_000_000 ? `${n / 1_000_000}M` : `${Math.round(n / 1000)}k`;

/**
 * De-noise control (beta backlog #26/#29). Default ON, so the flagship screener +
 * movers lead with recognizable markets instead of micro-metros tied at the score
 * ceiling. Toggling OFF restores every market size — the score is never changed,
 * only which rows are shown. Styled as an M3 filter chip to match PresetChips.
 */
export function MarketSizeToggle({
  geo,
  hideSmallMarkets,
  onChange,
}: MarketSizeToggleProps) {
  const floor = MARKET_SIZE_FLOOR[geo];
  // ZIP has no own population, so it is floored on its parent county's size.
  const basis = geo === "zip" ? "county" : geo;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={hideSmallMarkets}
      onClick={() => onChange(!hideSmallMarkets)}
      title={
        hideSmallMarkets
          ? `Showing markets with ${basis} population ≥ ${formatPop(
              floor,
            )}. Click to include smaller markets.`
          : `Showing all market sizes. Click to focus on ${basis} population ≥ ${formatPop(
              floor,
            )}.`
      }
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        whitespace-nowrap border transition-all duration-200
        ${
          hideSmallMarkets
            ? "bg-primary text-on-primary border-primary shadow-sm"
            : "bg-surface text-on-surface-variant border-outline hover:border-primary hover:text-primary hover:bg-primary-container/30"
        }
      `}
    >
      <Building2 className="w-4 h-4" />
      Major markets only
    </button>
  );
}
