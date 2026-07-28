import React from "react";
import { Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { MeshBackground } from "../primitives/MeshBackground";
import { Comparison } from "../scenes/Comparison";
import { Intro } from "../scenes/Intro";
import { Outro } from "../scenes/Outro";
import type { SingleMarketVideoProps } from "../types";
import { coerceMarketData, coerceComparisonMarket } from "./helpers";
import { useLayoutConfig } from "../layout/useLayoutConfig";

/** Fixed beats for head_to_head's 1800-frame composition. */
const INTRO_FRAMES = 90;
const OUTRO_FROM = 1650;

export const HeadToHeadLayout: React.FC<SingleMarketVideoProps> = (props) => {
  const bundle = (props.dataBundle ?? {}) as Record<string, any>;
  // Accept both shape A (markets array) and shape B (primary/secondary).
  const arr: any[] = Array.isArray(bundle.markets) ? bundle.markets : [];
  const a = arr[0] ?? bundle.primary ?? null;
  const b = arr[1] ?? bundle.secondary ?? null;
  const primary = coerceMarketData(a, "Market A");
  const secondary = coerceComparisonMarket(b, "Market B");
  const { format } = useLayoutConfig();
  // Without a bumper the whole opening shifts to frame 0 and the freed
  // frames go to the comparison beat — the content people came for.
  const bumperFrames = format.openWithBumper ? 60 : 0;
  const introFrom = bumperFrames;
  const comparisonFrom = introFrom + INTRO_FRAMES;
  return (
    <>
      {/* Persistent stage — scenes paint no solid fills of their own. */}
      <MeshBackground />
      {format.openWithBumper && (
        <Sequence from={0} durationInFrames={bumperFrames}>
          <BrandBumper />
        </Sequence>
      )}
      <Sequence from={introFrom} durationInFrames={INTRO_FRAMES}>
        {/*
          Strip the state suffix from each market name for the intro so the
          comma-split inside `Intro` doesn't render "Cleveland / OH vs Austin, TX".
          Full names still appear inside the Comparison scene below.
        */}
        <Intro
          marketName={`${primary.market.split(",")[0].trim()} vs ${secondary.market.split(",")[0].trim()}`}
          durationInFrames={INTRO_FRAMES}
        />
      </Sequence>
      <Sequence
        from={comparisonFrom}
        durationInFrames={OUTRO_FROM - comparisonFrom}
      >
        <Comparison primary={primary} others={[secondary]} />
      </Sequence>
      <Sequence from={OUTRO_FROM} durationInFrames={90}>
        <Outro ctaUrl={props.ctaUrl} durationInFrames={90} />
      </Sequence>
      <Sequence from={OUTRO_FROM + 90} durationInFrames={60}>
        <BrandOutroCard ctaUrl={props.ctaUrl} score={primary.score} />
      </Sequence>
    </>
  );
};
