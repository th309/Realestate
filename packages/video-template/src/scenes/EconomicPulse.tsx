import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { COLORS } from "../constants";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface EconomicPulseProps {
  market: string;
  unemploymentPct: number;
  jobGrowthYoyPct: number;
}

/**
 * Secondary long-form beat when score history is unavailable: labor market
 * framing so the segment is not a repeat of StatCards.
 */
export const EconomicPulse: React.FC<EconomicPulseProps> = ({
  market,
  unemploymentPct,
  jobGrowthYoyPct,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const sceneOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pulse = spring({
    fps,
    frame,
    config: { damping: 16, stiffness: 90 },
    durationInFrames: 35,
  });

  const bandOpacity = interpolate(pulse, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleSize = isVertical ? 44 : 32;
  const heroSize = isVertical ? 72 : 56;
  const subtitleSize = isVertical ? 26 : 20;

  const unempLabel = `${unemploymentPct.toFixed(1)}%`;
  const jobLabel =
    jobGrowthYoyPct >= 0
      ? `+${jobGrowthYoyPct.toFixed(1)}%`
      : `${jobGrowthYoyPct.toFixed(1)}%`;

  return (
    <div
      style={{
        width,
        height,
        background: `linear-gradient(165deg, ${COLORS.bg} 0%, #252540 55%, ${COLORS.bg} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        opacity: sceneOpacity,
        padding: isVertical ? "48px 56px" : "40px 100px",
        boxSizing: "border-box",
        gap: isVertical ? 36 : 28,
      }}
    >
      <div
        style={{
          fontSize: titleSize,
          fontWeight: 700,
          color: COLORS.text,
          alignSelf: "flex-start",
          width: "100%",
        }}
      >
        Economy & jobs
        <span
          style={{
            color: COLORS.textMuted,
            fontWeight: 400,
            fontSize: titleSize * 0.62,
          }}
        >
          {" "}
          — {market}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          gap: isVertical ? 28 : 40,
          width: "100%",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            flex: 1,
            borderRadius: 24,
            padding: isVertical ? 36 : 32,
            background: `linear-gradient(135deg, rgba(57,73,171,0.35) 0%, rgba(26,35,126,0.5) 100%)`,
            border: `1px solid rgba(91, 107, 192, 0.65)`,
            opacity: bandOpacity,
          }}
        >
          <div
            style={{
              fontSize: subtitleSize,
              color: COLORS.textMuted,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            Unemployment rate
          </div>
          <div
            style={{
              fontSize: heroSize,
              fontWeight: 800,
              color: COLORS.text,
              letterSpacing: "-2px",
            }}
          >
            {unempLabel}
          </div>
          <div style={{ fontSize: subtitleSize - 2, color: COLORS.textDim }}>
            BLS / economic feed
          </div>
        </div>

        <div
          style={{
            flex: 1,
            borderRadius: 24,
            padding: isVertical ? 36 : 32,
            background: `linear-gradient(135deg, rgba(0,200,83,0.2) 0%, rgba(57,73,171,0.35) 100%)`,
            border: `1px solid ${COLORS.accent}`,
            opacity: bandOpacity,
          }}
        >
          <div
            style={{
              fontSize: subtitleSize,
              color: COLORS.textMuted,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            Job growth (YoY)
          </div>
          <div
            style={{
              fontSize: heroSize,
              fontWeight: 800,
              color: jobGrowthYoyPct >= 0 ? COLORS.accent : COLORS.tierRed,
              letterSpacing: "-2px",
            }}
          >
            {jobLabel}
          </div>
          <div style={{ fontSize: subtitleSize - 2, color: COLORS.textDim }}>
            Year-over-year change
          </div>
        </div>
      </div>
    </div>
  );
};
