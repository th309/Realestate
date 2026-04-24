// Brand colors hardcoded; Task 2.28 will move them to a shared variant module.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface RankingRowProps {
  rank: number;
  marketName: string;
  keyStat: string;
  keyStatLabel: string;
}

/**
 * Single row in a Top-N ranking sequence. The row slides up from below
 * with a spring, fades in, and presents:
 *   - a rank circle on the left (large monospace number on indigo)
 *   - the market name + a small subtitle label in the centre
 *   - the headline key stat on the right (mono, large) above its label
 *
 * Designed to live inside a parent <Sequence> that controls when the
 * row is mounted, so the row simply renders its entrance animation
 * relative to its own currentFrame.
 */
export const RankingRow: React.FC<RankingRowProps> = ({
  rank,
  marketName,
  keyStat,
  keyStatLabel,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
    durationInFrames: 24,
  });
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = (1 - enter) * 80 * scale;

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 24 * scale,
        padding: `${28 * scale}px ${36 * scale}px`,
        display: "flex",
        alignItems: "center",
        gap: 32 * scale,
        boxShadow: "0 8px 24px rgba(26, 35, 126, 0.18)",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          width: 96 * scale,
          height: 96 * scale,
          borderRadius: "50%",
          backgroundColor: "#3949AB",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Roboto Mono",
          fontWeight: 700,
          fontSize: 44 * scale,
          flexShrink: 0,
        }}
      >
        {rank}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 4 * scale,
          minWidth: 0,
        }}
      >
        <div
          style={{
            color: "#1A237E",
            fontFamily: "Roboto",
            fontWeight: 700,
            fontSize: 40 * scale,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {marketName}
        </div>
        <div
          style={{
            color: "#5C6BC0",
            fontFamily: "Roboto",
            fontWeight: 500,
            fontSize: 22 * scale,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Rank #{rank}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4 * scale,
        }}
      >
        <div
          style={{
            color: "#1A237E",
            fontFamily: "Roboto Mono",
            fontWeight: 700,
            fontSize: 48 * scale,
            letterSpacing: "0.02em",
          }}
        >
          {keyStat}
        </div>
        <div
          style={{
            color: "#5C6BC0",
            fontFamily: "Roboto",
            fontWeight: 500,
            fontSize: 20 * scale,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {keyStatLabel}
        </div>
      </div>
    </div>
  );
};
