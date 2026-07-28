import React from "react";
import {
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "../constants";
import { AnimatedEntrance, EASINGS } from "../motion";
import { FONTS, brandBorder, brandFill } from "../styles/tokens";
import { useLayoutConfig } from "../layout/useLayoutConfig";

interface OutroProps {
  ctaUrl: string;
  ctaLabel?: string;
  marketName?: string;
  /** The hosting Sequence's length — the exit fade anchors to its end. */
  durationInFrames?: number;
}

export const Outro: React.FC<OutroProps> = ({
  ctaUrl: _ctaUrl,
  ctaLabel,
  durationInFrames = 210,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  // Scripted exit — accelerate out over the final 20 frames.
  const finalFade = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    {
      easing: EASINGS.exit,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const shortmarkSize = isVertical ? 180 : 140;
  const wordmarkWidth = isVertical ? 480 : 360;
  const ctaSize = isVertical ? 32 : 24;
  const urlSize = isVertical ? 36 : 28;
  const subscribeSize = isVertical ? 28 : 20;

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONTS.body,
        opacity: finalFade,
        gap: isVertical ? 32 : 24,
        padding: isVertical ? "0 80px" : "0 160px",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      {/* PIQ shortmark — same asset as BrandBumper for brand continuity */}
      <AnimatedEntrance index={0} from="scale" preset="pop">
        <Img
          src={staticFile("brand/piq-shortmark-192px-normal.png")}
          style={{
            width: shortmarkSize,
            height: shortmarkSize,
            objectFit: "contain",
          }}
        />
      </AnimatedEntrance>

      {/* PropertyIQ wordmark lockup (includes the real tagline
          "The IQ Behind Every Market"; no separate text tagline needed) */}
      <AnimatedEntrance index={1} from="rise" distance={20}>
        <Img
          src={staticFile("brand/piq-logo-primary-dark-reversed.png")}
          style={{
            width: wordmarkWidth,
            height: "auto",
            objectFit: "contain",
          }}
        />
      </AnimatedEntrance>

      {/* Divider */}
      <AnimatedEntrance index={2} from="none">
        <div
          style={{
            width: isVertical ? 500 : 600,
            height: 1,
            background: `linear-gradient(to right, transparent, ${COLORS.bgCardAlt}, transparent)`,
          }}
        />
      </AnimatedEntrance>

      {/* CTA */}
      <AnimatedEntrance index={3} delay={30} from="rise">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: ctaSize,
              color: COLORS.textMuted,
              fontWeight: 400,
            }}
          >
            {ctaLabel ?? "Every scored market, one place"}
          </div>
          <div
            style={{
              fontSize: urlSize,
              fontWeight: 700,
              fontFamily: FONTS.mono,
              color: COLORS.accent,
              letterSpacing: "0.02em",
              background: brandFill(COLORS.accent),
              border: brandBorder(COLORS.accent, 0.5),
              borderRadius: 999,
              padding: isVertical ? "16px 44px" : "12px 36px",
            }}
          >
            propertyiq.app
          </div>
        </div>
      </AnimatedEntrance>

      {/* Subscribe prompt */}
      <AnimatedEntrance index={4} delay={45} from="rise">
        <div
          style={{
            fontSize: subscribeSize,
            color: COLORS.textDim,
            fontStyle: "italic",
          }}
        >
          Subscribe for weekly market scores.
        </div>
      </AnimatedEntrance>
    </div>
  );
};
