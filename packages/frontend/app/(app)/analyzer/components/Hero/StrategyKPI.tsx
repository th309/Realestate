"use client";

import { KpiTile } from "@/app/components/app-shell";
import { piq } from "../primitives/piqTokens";
import { formatNumericValue } from "../primitives/MetricBlock";
import {
  directionalLevel,
  type DirectionalLevel,
} from "../primitives/useDirectionalColor";
import { MAOTile } from "./MAOTile";
import { MetricsExpander } from "../MetricsExpander";
import {
  getPrimaryTiles,
  STRATEGY_LABEL,
  type Strategy,
  type TileContext,
} from "../../lib/strategy-tile-mappers";
import { getSecondaryMetrics } from "../../lib/strategy-secondary-mappers";

interface StrategyKPIProps {
  ctx: TileContext;
  /** Active strategy — driven by InputPanel's StrategyControls in focused mode, or bestPlay in compare mode. */
  active: Strategy;
  /** When true, a small header callout shows that this is the winning strategy in compare mode. */
  isCompareWinner?: boolean;
}

/**
 * What each headline metric actually is.
 *
 * A bare "DSCR" assumes the reader already knows the term; the caption says
 * "NOI / debt service" so the tile teaches as it reports.
 */
const TILE_CAPTIONS: Record<string, string> = {
  "Monthly cash flow": "After debt service",
  "Cash-on-cash": "Annual CF / cash in",
  "Cap rate": "NOI / purchase price",
  DSCR: "NOI / debt service",
  NOI: "Rent less operating expenses",
  "Price / unit": "Purchase price / unit",
  "Total profit": "Sale proceeds less all-in cost",
  "Cash left in": "Capital still tied up after refinance",
};

/** Health verdict -> KpiTile stripe + value tone, from the one threshold rule. */
const LEVEL_TONE = {
  good: "positive",
  warn: "neutral",
  bad: "negative",
  neutral: "neutral",
  muted: "neutral",
} as const satisfies Record<
  DirectionalLevel,
  "neutral" | "positive" | "negative"
>;

const LEVEL_ACCENT = {
  good: "tertiary",
  warn: "warning",
  bad: "error",
  neutral: "primary",
  muted: "primary",
} as const satisfies Record<
  DirectionalLevel,
  "primary" | "tertiary" | "warning" | "error"
>;

export function StrategyKPI({
  ctx,
  active,
  isCompareWinner = false,
}: StrategyKPIProps) {
  const tiles = getPrimaryTiles(active, ctx);

  return (
    <section data-strategy-kpi className="space-y-3">
      {/* Strategy name is already shown on the DealGrade chip above and in the
          Compare Strategies cards below — repeating it here was redundant.
          Only the "BEST PLAY" badge surfaces here (compare mode only). */}
      {isCompareWinner && (
        <div className="flex items-center gap-2">
          <span
            aria-label={`${STRATEGY_LABEL[active]} is the best play`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
            style={{
              background: piq.amber,
              color: piq.textPrimary,
            }}
          >
            ★ BEST PLAY
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile, i) => {
          if (tile.kind === "mao") {
            return (
              <MAOTile
                key={`mao-${i}`}
                mao={tile.mao}
                currentPrice={tile.currentPrice}
              />
            );
          }

          const numeric = tile.value ?? Number.NaN;
          const level = directionalLevel({
            value: numeric,
            variant: "directional",
            threshold: tile.threshold,
          });

          return (
            <KpiTile
              key={`${tile.label}-${i}`}
              label={tile.label}
              value={formatNumericValue(numeric, tile.format, 1)}
              caption={TILE_CAPTIONS[tile.label]}
              accent={LEVEL_ACCENT[level]}
              tone={LEVEL_TONE[level]}
            />
          );
        })}
      </div>

      <MetricsExpander metrics={getSecondaryMetrics(active, ctx)} />
    </section>
  );
}
