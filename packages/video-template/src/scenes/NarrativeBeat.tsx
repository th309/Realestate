import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { COLORS } from "../constants";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface NarrativeBeatProps {
  market: string;
  title: string;
  excerpt: string;
}

/**
 * Long-form chapter overlay for narrative beats without a dedicated chart
 * (e.g. investor profile / positioning).
 */
export const NarrativeBeat: React.FC<NarrativeBeatProps> = ({
  market,
  title,
  excerpt,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const opacity = interpolate(frame, [0, 14], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleSize = isVertical ? 38 : 28;
  const bodySize = isVertical ? 26 : 20;
  const tagSize = isVertical ? 20 : 15;

  const trimmed =
    excerpt.length > 560 ? `${excerpt.slice(0, 557).trim()}…` : excerpt;

  return (
    <div
      style={{
        width,
        height,
        background: `radial-gradient(ellipse at 30% 20%, rgba(57,73,171,0.35) 0%, ${COLORS.bg} 55%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        opacity,
        padding: isVertical ? "56px 52px" : "48px 96px",
        boxSizing: "border-box",
        gap: 20,
      }}
    >
      <div
        style={{
          fontSize: tagSize,
          fontWeight: 700,
          color: COLORS.accent,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        {market}
      </div>
      <div
        style={{
          fontSize: titleSize,
          fontWeight: 800,
          color: COLORS.text,
          lineHeight: 1.15,
          maxWidth: "92%",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: bodySize,
          fontWeight: 400,
          color: COLORS.textMuted,
          lineHeight: 1.45,
          maxWidth: "95%",
          whiteSpace: "pre-wrap",
        }}
      >
        {trimmed}
      </div>
    </div>
  );
};
