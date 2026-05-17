"use client";

import { piq } from "../primitives/piqTokens";
import { MetricBlock } from "../primitives/MetricBlock";
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

function TileShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: piq.surface,
        border: `0.5px solid ${piq.border}`,
        borderRadius: 16,
        padding: 20,
      }}
    >
      {children}
    </div>
  );
}

export function StrategyKPI({
  ctx,
  active,
  isCompareWinner = false,
}: StrategyKPIProps) {
  const tiles = getPrimaryTiles(active, ctx);

  return (
    <section data-strategy-kpi className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="text-xs uppercase font-semibold tracking-wider"
          style={{ color: piq.textMuted }}
        >
          {STRATEGY_LABEL[active]}
        </span>
        {isCompareWinner && (
          <span
            aria-label="Best play"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
            style={{
              background: piq.amber,
              color: "#1A237E",
            }}
          >
            ★ BEST PLAY
          </span>
        )}
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        style={{ gap: 12 }}
      >
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
          return (
            <TileShell key={`${tile.label}-${i}`}>
              <MetricBlock
                label={tile.label}
                value={tile.value ?? Number.NaN}
                format={tile.format}
                size="lg"
                variant="directional"
                threshold={tile.threshold}
              />
            </TileShell>
          );
        })}
      </div>

      <MetricsExpander metrics={getSecondaryMetrics(active, ctx)} />
    </section>
  );
}
