import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { RankingRow } from "../primitives/RankingRow";
import { Intro } from "../scenes/Intro";
import { Outro } from "../scenes/Outro";
import type { VideoProps } from "../types";

// Frame budget must stay in sync with calculateRankingMetadata in PropertyIQVideo.tsx
const BUMPER_FRAMES = 60; // 2.0s brand sting
const INTRO_FRAMES = 90; // 3.0s
const ROW_FRAMES = 150; // 5.0s per row @ 30fps
const OUTRO_FRAMES = 135; // 4.5s

const ROWS_START = BUMPER_FRAMES + INTRO_FRAMES; // 150

const ACCENT_BY_THEME = {
  top: "#00C853",
  bottom: "#FF8F00",
} as const;

const INTRO_COPY_BY_THEME = {
  top: "Top markets",
  bottom: "Markets to avoid",
} as const;

const OUTRO_COPY_BY_THEME = {
  top: "Find your next market →",
  bottom: "Skip these. Find better →",
} as const;

interface Top10LayoutProps extends VideoProps {
  theme?: "top" | "bottom";
}

export const Top10Layout: React.FC<Top10LayoutProps> = (props) => {
  const theme = props.theme ?? "top";
  const accent = ACCENT_BY_THEME[theme];
  const introCopy = INTRO_COPY_BY_THEME[theme];
  const outroCopy = OUTRO_COPY_BY_THEME[theme];

  const params = props.params;
  const markets = params?.resolved_markets ?? [];
  const metricFormat = params?.metric?.format ?? "number";
  const metricLabel = params?.metric?.label ?? "Value";
  const scopeLabel = params?.scope?.label;

  // Build the intro headline: e.g. "Top markets · California"
  const introHeadline = scopeLabel ? `${introCopy} · ${scopeLabel}` : introCopy;

  // Reveal cadence: #N down to #1 (highest rank last for maximum impact)
  const ordered = markets.slice(0, 10).reverse();

  const rowsTotal = ordered.length * ROW_FRAMES;
  const outroStart = ROWS_START + rowsTotal;
  const bumperOutroStart = outroStart + OUTRO_FRAMES;

  return (
    <>
      <Sequence from={0} durationInFrames={BUMPER_FRAMES}>
        <BrandBumper />
      </Sequence>

      <Sequence from={BUMPER_FRAMES} durationInFrames={INTRO_FRAMES}>
        <Intro marketName={introHeadline} />
      </Sequence>

      <Sequence from={ROWS_START} durationInFrames={rowsTotal}>
        {ordered.map((market, i) => (
          <Sequence
            key={market.region_id}
            from={i * ROW_FRAMES}
            durationInFrames={ROW_FRAMES}
          >
            <AbsoluteFill
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 60px",
              }}
            >
              <div style={{ width: "100%", maxWidth: 960 }}>
                <RankingRow
                  rank={market.rank}
                  marketName={`${market.region_name}, ${market.state}`}
                  keyStat={market.value_formatted}
                  keyStatLabel={metricLabel}
                  accent={accent}
                  format={metricFormat}
                />
              </div>
            </AbsoluteFill>
          </Sequence>
        ))}
      </Sequence>

      <Sequence from={outroStart} durationInFrames={OUTRO_FRAMES}>
        <Outro ctaUrl={props.ctaUrl} ctaLabel={outroCopy} />
      </Sequence>

      <Sequence from={bumperOutroStart} durationInFrames={120}>
        <BrandOutroCard ctaUrl={props.ctaUrl} />
      </Sequence>
    </>
  );
};
