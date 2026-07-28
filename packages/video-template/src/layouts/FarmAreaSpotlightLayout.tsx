// packages/video-template/src/layouts/FarmAreaSpotlightLayout.tsx
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { FarmAreaGrid } from "../primitives/FarmAreaGrid";
import { MeshBackground } from "../primitives/MeshBackground";
import { Intro } from "../scenes/Intro";
import { Outro } from "../scenes/Outro";
import { useLayoutConfig } from "../layout/useLayoutConfig";
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

/**
 * Beat table for the farm-area spotlight. Exported so `audio/sfx-cues.ts`
 * frame-locks its cues to the SAME numbers the layout renders from.
 */
/**
 * Beats for farm_area_spotlight's 1800-frame composition. Without a bumper
 * the open shifts to frame 0 and the grid beat absorbs the freed frames.
 */
export function buildFarmAreaBeats(openWithBumper = false) {
  const bumperDuration = openWithBumper ? 60 : 0;
  const introFrom = bumperDuration;
  const gridFrom = introFrom + 90;
  return {
    bumper: { from: 0, duration: bumperDuration },
    intro: { from: introFrom, duration: 90 },
    grid: { from: gridFrom, duration: 1500 - gridFrom },
    outro: { from: 1500, duration: 210 },
    brand: { from: 1710, duration: 90 },
  };
}

/** Cards in the grid — the fallback and the real slice are both capped at 3. */
export const FARM_AREA_CARD_COUNT = 3;

export const FarmAreaSpotlightLayout: React.FC<SingleMarketVideoProps> = (
  props,
) => {
  const bundle = (props.dataBundle ?? {}) as Record<string, unknown>;
  const areas = coerceAreas(bundle);
  const { format } = useLayoutConfig();
  const beats = buildFarmAreaBeats(format.openWithBumper);
  return (
    <>
      <MeshBackground />
      {format.openWithBumper && (
        <Sequence
          from={beats.bumper.from}
          durationInFrames={beats.bumper.duration}
        >
          <BrandBumper />
        </Sequence>
      )}
      <Sequence from={beats.intro.from} durationInFrames={beats.intro.duration}>
        <Intro marketName={props.resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={beats.grid.from} durationInFrames={beats.grid.duration}>
        <AbsoluteFill
          style={{
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
      <Sequence from={beats.outro.from} durationInFrames={beats.outro.duration}>
        <Outro ctaUrl={props.ctaUrl} />
      </Sequence>
      <Sequence from={beats.brand.from} durationInFrames={beats.brand.duration}>
        <BrandOutroCard ctaUrl={props.ctaUrl} />
      </Sequence>
    </>
  );
};
