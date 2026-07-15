"use client";
import React from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import { formatExplorerValue } from "../lib/explorer-math";
import { US_STATE_TILES, type ExplorerFormat } from "../lib/explorer-config";

interface TileEntity {
  id: string;
  name: string;
  state: string;
}
export interface StateTileMapProps {
  entities: TileEntity[];
  scoreByRegion: Record<string, number | null>;
  valueByRegion: Record<string, number | null>;
  format: ExplorerFormat;
  onDrill: (fips: string, name: string, abbr: string) => void;
}

export function StateTileMap({
  entities,
  scoreByRegion,
  valueByRegion,
  format,
  onDrill,
}: StateTileMapProps) {
  const byAbbr = new Map(entities.map((e) => [e.state, e]));

  const handleTileKeyDown = (
    fips: string,
    name: string,
    abbr: string,
    e: React.KeyboardEvent,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onDrill(fips, name, abbr);
    }
  };

  return (
    <div style={{ padding: "8px 8px 4px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12,1fr)",
          gap: 6,
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        {Object.entries(US_STATE_TILES).map(([abbr, [c, r]]) => {
          const region = byAbbr.get(abbr);
          const score = region ? scoreByRegion[region.id] : null;
          const val = region ? valueByRegion[region.id] : null;
          const hasData = region != null && score != null;
          const color = hasData
            ? getScoreColor(score as number, 100)
            : "var(--md-on-surface-variant)";
          return (
            <div
              key={abbr}
              role={hasData ? "button" : undefined}
              tabIndex={hasData ? 0 : undefined}
              onClick={
                hasData
                  ? () => onDrill(region!.id, region!.name, abbr)
                  : undefined
              }
              onKeyDown={
                hasData
                  ? (e) => handleTileKeyDown(region!.id, region!.name, abbr, e)
                  : undefined
              }
              style={{
                gridColumn: c + 1,
                gridRow: r + 1,
                aspectRatio: "1",
                borderRadius: 8,
                background: hasData
                  ? `color-mix(in srgb, ${color} 26%, var(--md-surface-container-low))`
                  : "var(--md-surface-container-high)",
                color: hasData
                  ? "var(--md-on-surface)"
                  : "var(--md-on-surface-variant)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                cursor: hasData ? "pointer" : "default",
                transition: "background .5s",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "var(--font-roboto-mono)",
                  opacity: hasData ? 1 : 0.45,
                }}
              >
                {abbr}
              </div>
              {hasData && (
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-roboto-mono)",
                    color,
                    fontWeight: 700,
                  }}
                >
                  {formatExplorerValue(val, format)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: 11,
          color: "var(--md-on-surface-variant)",
          padding: "10px 0 4px",
        }}
      >
        State average of tracked metros · click a state to drill into its metros
        · gray = no tracked metro
      </div>
    </div>
  );
}
