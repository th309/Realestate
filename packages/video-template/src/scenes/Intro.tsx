import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { COLORS } from "../constants";
import { useLayoutConfig } from "../layout/useLayoutConfig";

interface IntroProps {
  marketName: string;
}

/**
 * 2-second "location reveal" card. Pure market-name typography — no
 * brand chrome (BrandBumper at 0-2s already anchored the brand).
 * The voice-over (delayed 2s to clear the bumper) begins at this frame
 * by naming the market, so the market name appears on screen in sync
 * with the narrator saying it.
 *
 * Splits the market into its primary city (pre-comma) and the state
 * segment (post-comma) so the main location reads big and clean while
 * the state detail sits as a smaller subtitle.
 */
export const Intro: React.FC<IntroProps> = ({ marketName }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const opacity = interpolate(frame, [0, 15, 50, 60], [0, 1, 1, 0], {
    easing: Easing.ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Letter-by-letter slide for the main label.
  const slideUp = interpolate(frame, [0, 20], [60, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const stateOpacity = interpolate(frame, [12, 28], [0, 1], {
    easing: Easing.ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const commaIdx = marketName.indexOf(",");
  const primary =
    commaIdx === -1
      ? marketName
      : marketName.slice(0, commaIdx).split("-")[0].trim();
  const suffix = commaIdx === -1 ? "" : marketName.slice(commaIdx + 1).trim();

  const primarySize = isVertical ? 140 : 100;
  const suffixSize = isVertical ? 40 : 28;
  const labelSize = isVertical ? 22 : 16;

  return (
    <div
      style={{
        width,
        height,
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        opacity,
      }}
    >
      {/* Small tag above the city — orients the viewer without chrome */}
      <div
        style={{
          fontSize: labelSize,
          fontWeight: 600,
          color: COLORS.accent,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
        }}
      >
        Market Spotlight
      </div>

      {/* Primary city, large */}
      <div
        style={{
          fontSize: primarySize,
          fontWeight: 800,
          color: COLORS.text,
          letterSpacing: "-2px",
          lineHeight: 1,
          textAlign: "center",
          transform: `translateY(${slideUp}px)`,
        }}
      >
        {primary}
      </div>

      {/* State / metro suffix, smaller */}
      {suffix && (
        <div
          style={{
            fontSize: suffixSize,
            fontWeight: 500,
            color: COLORS.textMuted,
            letterSpacing: "0.05em",
            opacity: stateOpacity,
          }}
        >
          {suffix}
        </div>
      )}
    </div>
  );
};
