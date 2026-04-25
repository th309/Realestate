import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { RankingRow } from "../primitives/RankingRow";
import { Intro } from "../scenes/Intro";
import { Outro } from "../scenes/Outro";
import type { VideoProps } from "../types";
import { pickState } from "./helpers";

export const Top10Layout: React.FC<VideoProps> = (props) => {
  const rankings = ((props.dataBundle as any)?.top_cashflow_markets ??
    []) as Array<{
    rank: number;
    name: string;
    rent_to_price_ratio: number;
  }>;
  const state = pickState(props);
  const ROW_FRAMES = 132; // 4.4s @ 30fps
  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={60} durationInFrames={90}>
        <Intro
          marketName={state ? `Top 10 Cashflow: ${state}` : "Top 10 Cashflow"}
        />
      </Sequence>
      <Sequence from={150} durationInFrames={ROW_FRAMES * 10}>
        {rankings
          .slice(0, 10)
          .reverse()
          .map((m, i) => (
            <Sequence
              key={m.rank}
              from={i * ROW_FRAMES}
              durationInFrames={ROW_FRAMES}
            >
              {/*
                Center the row horizontally with a generous max-width. The plan's
                literal `padding: '40%'` would have squeezed the 9:16 frame to a
                216px-wide strip, which can't fit a 56px rank circle + name + stat.
              */}
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
                    rank={m.rank}
                    marketName={m.name}
                    keyStat={
                      typeof m.rent_to_price_ratio === "number"
                        ? m.rent_to_price_ratio.toFixed(2)
                        : "—"
                    }
                    keyStatLabel="Rent/Price"
                  />
                </div>
              </AbsoluteFill>
            </Sequence>
          ))}
      </Sequence>
      <Sequence from={1470} durationInFrames={210}>
        <Outro ctaUrl={props.ctaUrl} />
      </Sequence>
      <Sequence from={1680} durationInFrames={120}>
        <BrandOutroCard ctaUrl={props.ctaUrl} />
      </Sequence>
    </>
  );
};
