import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants";
import { AnimatedEntrance, EASINGS } from "../motion";
import { BORDER_WIDTH, FONTS } from "../styles/tokens";
import { useLayoutConfig } from "../layout/useLayoutConfig";

interface IntroProps {
  marketName: string;
  /** The hosting Sequence's length — the exit fade anchors to its end. */
  durationInFrames?: number;
}

/**
 * "Location reveal" beat. Asymmetric lower-third: eyebrow + rule,
 * then the city name set huge and left-aligned — a title card, not a
 * centered template. The VO names the market at this exact beat.
 */
export const Intro: React.FC<IntroProps> = ({
  marketName,
  durationInFrames = 60,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  // Scripted scene exit — accelerate out (M3 exit), no bounce.
  const sceneOpacity = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    {
      easing: EASINGS.exit,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const commaIdx = marketName.indexOf(",");
  const primary =
    commaIdx === -1
      ? marketName
      : marketName.slice(0, commaIdx).split("-")[0].trim();
  const suffix = commaIdx === -1 ? "" : marketName.slice(commaIdx + 1).trim();

  const primarySize = isVertical ? 148 : 108;
  const suffixSize = isVertical ? 42 : 30;
  const labelSize = isVertical ? 24 : 17;

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        fontFamily: FONTS.body,
        opacity: sceneOpacity,
      }}
    >
      {/* Lower-third anchor: left edge, ~62% down the frame */}
      <div
        style={{
          position: "absolute",
          left: isVertical ? 96 : 140,
          right: isVertical ? 64 : 400,
          top: isVertical ? "56%" : "52%",
          display: "flex",
          flexDirection: "column",
          gap: isVertical ? 22 : 16,
        }}
      >
        <AnimatedEntrance index={0} from="left" distance={32}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 56,
                height: BORDER_WIDTH,
                background: COLORS.accent,
              }}
            />
            <span
              style={{
                fontSize: labelSize,
                fontWeight: 600,
                color: COLORS.accent,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
              }}
            >
              Market Spotlight
            </span>
          </div>
        </AnimatedEntrance>

        <AnimatedEntrance index={1} from="rise" distance={48}>
          <div
            style={{
              fontSize: primarySize,
              fontWeight: 800,
              color: COLORS.text,
              letterSpacing: "-3px",
              lineHeight: 0.98,
            }}
          >
            {primary}
          </div>
        </AnimatedEntrance>

        {suffix && (
          <AnimatedEntrance index={2} from="rise" distance={28}>
            <div
              style={{
                fontSize: suffixSize,
                fontWeight: 500,
                color: COLORS.textMuted,
                letterSpacing: "0.06em",
              }}
            >
              {suffix}
            </div>
          </AnimatedEntrance>
        )}
      </div>
    </div>
  );
};
