// packages/video-template/src/layouts/FarmAreaSpotlightLayout.tsx
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { FarmAreaGrid } from "../primitives/FarmAreaGrid";
import { Intro } from "../scenes/Intro";
import { Outro } from "../scenes/Outro";
import type { SingleMarketVideoProps } from "../types";

interface FarmAreaRaw {
  zip?: string | number;
  medianPrice?: number;
  median_price?: number;
  median_home_value?: number;
  turnoverPct?: number;
  turnover_pct?: number;
  absenteePct?: number;
  absentee_pct?: number;
}

interface FarmAreaGridArea {
  zip: string;
  medianPrice: number;
  turnoverPct: number;
  absenteePct: number;
}

function coerceAreas(bundle: Record<string, unknown>): FarmAreaGridArea[] {
  const raw = (bundle.farm_areas ?? bundle.areas ?? []) as FarmAreaRaw[];
  if (!Array.isArray(raw) || raw.length === 0) {
    // Fallback so the test fixture renders even with an empty bundle. Three
    // anonymous "—" cards beats a blank grid in QA snapshots.
    return [
      { zip: "—", medianPrice: 0, turnoverPct: 0, absenteePct: 0 },
      { zip: "—", medianPrice: 0, turnoverPct: 0, absenteePct: 0 },
      { zip: "—", medianPrice: 0, turnoverPct: 0, absenteePct: 0 },
    ];
  }
  return raw.slice(0, 3).map((a) => ({
    zip: typeof a.zip === "number" ? String(a.zip) : (a.zip ?? "—"),
    medianPrice: a.medianPrice ?? a.median_price ?? a.median_home_value ?? 0,
    turnoverPct: a.turnoverPct ?? a.turnover_pct ?? 0,
    absenteePct: a.absenteePct ?? a.absentee_pct ?? 0,
  }));
}

export const FarmAreaSpotlightLayout: React.FC<SingleMarketVideoProps> = (
  props,
) => {
  const bundle = (props.dataBundle ?? {}) as Record<string, unknown>;
  const areas = coerceAreas(bundle);
  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={60} durationInFrames={90}>
        <Intro marketName={props.resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={150} durationInFrames={1350}>
        <AbsoluteFill
          style={{
            backgroundColor: "#1A1A2E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 60px",
          }}
        >
          <div style={{ width: "100%", maxWidth: 960 }}>
            <FarmAreaGrid areas={areas} />
          </div>
        </AbsoluteFill>
      </Sequence>
      <Sequence from={1500} durationInFrames={210}>
        <Outro ctaUrl={props.ctaUrl} />
      </Sequence>
      <Sequence from={1710} durationInFrames={90}>
        <BrandOutroCard ctaUrl={props.ctaUrl} />
      </Sequence>
    </>
  );
};
