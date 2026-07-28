import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, LONG_FORM_METRO_HERO_SECONDS } from "../constants";
import { AnimatedEntrance, EASINGS } from "../motion";
import { FONTS, PALETTE, withAlpha } from "../styles/tokens";

type MetroHeroStillProps = {
  /** HTTPS URL from `metro-hero-curated-urls.json` or `resolvedMarket.hero_image_url`. */
  imageUrl: string;
  marketLabel: string;
  /** Hosting Sequence's length — the Ken-Burns move spans it. */
  durationInFrames?: number;
};

/** Full-frame still after the map fly — city photo from curated URLs / pipeline props. */
export const MetroHeroStill: React.FC<MetroHeroStillProps> = ({
  imageUrl,
  marketLabel,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const heroFrames = Math.max(
    1,
    durationInFrames ?? Math.round(fps * LONG_FORM_METRO_HERO_SECONDS),
  );

  const opacity = interpolate(frame, [0, 18], [0, 1], {
    easing: EASINGS.standard,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scripted Ken-Burns: settle out of a 12% push-in with a slow lateral drift.
  const kenBurns = interpolate(frame, [0, heroFrames], [0, 1], {
    easing: EASINGS.emphasized,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = 1.12 - kenBurns * 0.12;
  const driftX = (kenBurns - 0.5) * 32;

  const labelShadow = `0 2px 12px ${withAlpha(PALETTE.stageDeep, 0.9)}`;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Img
        src={imageUrl}
        alt=""
        delayRenderTimeoutInMilliseconds={25_000}
        style={{
          width,
          height,
          objectFit: "cover",
          opacity,
          transform: `scale(${scale}) translateX(${driftX}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, ${withAlpha(PALETTE.stageDeep, 0.92)} 0%, transparent 45%)`,
          pointerEvents: "none",
        }}
      />
      <AnimatedEntrance
        index={0}
        delay={12}
        from="rise"
        preset="gentle"
        distance={20}
        style={{
          position: "absolute",
          bottom: 48,
          left: 0,
          right: 0,
        }}
      >
        <div
          style={{
            textAlign: "center",
            pointerEvents: "none",
            fontFamily: FONTS.body,
            fontSize: 26,
            fontWeight: 700,
            color: COLORS.text,
            textShadow: labelShadow,
          }}
        >
          {marketLabel}
        </div>
      </AnimatedEntrance>
    </AbsoluteFill>
  );
};
