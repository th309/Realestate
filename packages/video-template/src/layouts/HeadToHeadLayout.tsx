import React from "react";
import { Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { Comparison } from "../scenes/Comparison";
import { Intro } from "../scenes/Intro";
import { Outro } from "../scenes/Outro";
import type { VideoProps } from "../types";
import { coerceMarketData, coerceComparisonMarket } from "./helpers";

export const HeadToHeadLayout: React.FC<VideoProps> = (props) => {
  const bundle = (props.dataBundle ?? {}) as Record<string, any>;
  // Accept both shape A (markets array) and shape B (primary/secondary).
  const arr: any[] = Array.isArray(bundle.markets) ? bundle.markets : [];
  const a = arr[0] ?? bundle.primary ?? null;
  const b = arr[1] ?? bundle.secondary ?? null;
  const primary = coerceMarketData(a, "Market A");
  const secondary = coerceComparisonMarket(b, "Market B");
  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={60} durationInFrames={90}>
        {/*
          Strip the state suffix from each market name for the intro so the
          comma-split inside `Intro` doesn't render "Cleveland / OH vs Austin, TX".
          Full names still appear inside the Comparison scene below.
        */}
        <Intro
          marketName={`${primary.market.split(",")[0].trim()} vs ${secondary.market.split(",")[0].trim()}`}
        />
      </Sequence>
      <Sequence from={150} durationInFrames={1500}>
        <Comparison primary={primary} others={[secondary]} />
      </Sequence>
      <Sequence from={1650} durationInFrames={90}>
        <Outro ctaUrl={props.ctaUrl} />
      </Sequence>
      <Sequence from={1740} durationInFrames={60}>
        <BrandOutroCard ctaUrl={props.ctaUrl} score={primary.score} />
      </Sequence>
    </>
  );
};
