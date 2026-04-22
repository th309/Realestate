import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLORS, scoreTierColor, scoreTierLabel } from "../constants";
import type { TrendDirection } from "../types";
import { useLayoutConfig } from "../layout/useLayoutConfig";

interface ScoreRevealProps {
  market: string;
  score: number;
  grade: string;
  trend: TrendDirection;
  trendChange: number;
  periodDate: string;
}

export const ScoreReveal: React.FC<ScoreRevealProps> = ({
  market,
  score,
  grade,
  trend,
  trendChange,
  periodDate,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const tierColor = scoreTierColor(score);

  // Fade in the whole scene
  const sceneOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Animated counter: 0 → score over ~120 frames with spring easing
  const counterProgress = spring({
    fps,
    frame,
    config: { damping: 20, stiffness: 80, mass: 1 },
    durationInFrames: 120,
  });
  const displayScore = Math.round(
    interpolate(counterProgress, [0, 1], [0, score]),
  );

  // Arc circle animation (SVG stroke-dashoffset trick)
  const circumference = 2 * Math.PI * 160;
  const arcProgress = interpolate(counterProgress, [0, 1], [0, score / 100]);
  const strokeDashoffset = circumference * (1 - arcProgress);

  // Grade badge appears after counter reaches ~80%
  const gradeOpacity = interpolate(frame, [80, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Trend indicator appears near end
  const trendOpacity = interpolate(frame, [100, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const trendColor =
    trend === "up"
      ? COLORS.trendUp
      : trend === "down"
        ? COLORS.trendDown
        : COLORS.trendStable;
  const trendSymbol = trend === "up" ? "▲" : trend === "down" ? "▼" : "●";
  const trendLabel =
    trend === "stable"
      ? "FLAT"
      : `${trend === "up" ? "+" : ""}${trendChange} pts`;

  const arcSize = isVertical ? 340 : 340;
  const arcRadius = arcSize / 2 - 20;
  const arcStroke = 18;
  const numberSize = isVertical ? 160 : 140;
  const marketSize = isVertical ? 48 : 36;
  const gradeSize = isVertical ? 36 : 28;
  const periodSize = isVertical ? 24 : 18;

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
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        opacity: sceneOpacity,
        gap: isVertical ? 32 : 24,
      }}
    >
      {/* Market name */}
      <div
        style={{
          fontSize: marketSize,
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: "-0.5px",
        }}
      >
        {market}
      </div>

      {/* Score ring */}
      <div style={{ position: "relative", width: arcSize, height: arcSize }}>
        <svg
          width={arcSize}
          height={arcSize}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: "rotate(-90deg)",
          }}
        >
          {/* Track */}
          <circle
            cx={arcSize / 2}
            cy={arcSize / 2}
            r={arcRadius}
            fill="none"
            stroke={COLORS.bgCard}
            strokeWidth={arcStroke}
          />
          {/* Progress arc */}
          <circle
            cx={arcSize / 2}
            cy={arcSize / 2}
            r={arcRadius}
            fill="none"
            stroke={tierColor}
            strokeWidth={arcStroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 12px ${tierColor}80)` }}
          />
        </svg>

        {/* Score number */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: numberSize,
              fontWeight: 900,
              color: tierColor,
              lineHeight: 1,
              letterSpacing: "-4px",
              textShadow: `0 0 40px ${tierColor}60`,
            }}
          >
            {displayScore}
          </span>
          <span
            style={{
              fontSize: isVertical ? 24 : 18,
              fontWeight: 500,
              color: COLORS.textMuted,
              marginTop: 4,
              letterSpacing: "0.1em",
            }}
          >
            / 100
          </span>
        </div>
      </div>

      {/* Grade badge */}
      <div
        style={{
          opacity: gradeOpacity,
          background: `${tierColor}20`,
          border: `2px solid ${tierColor}`,
          borderRadius: 12,
          padding: isVertical ? "16px 40px" : "12px 32px",
          fontSize: gradeSize,
          fontWeight: 800,
          color: tierColor,
          letterSpacing: "0.15em",
        }}
      >
        {grade}
      </div>

      {/* Trend indicator */}
      <div
        style={{
          opacity: trendOpacity,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: isVertical ? 32 : 24,
          color: trendColor,
          fontWeight: 600,
        }}
      >
        <span>{trendSymbol}</span>
        <span>{trendLabel}</span>
        <span style={{ color: COLORS.textDim, fontSize: isVertical ? 24 : 18 }}>
          vs last month
        </span>
      </div>

      {/* Period date */}
      <div
        style={{
          fontSize: periodSize,
          color: COLORS.textDim,
          opacity: trendOpacity,
        }}
      >
        Scored{" "}
        {new Date(periodDate).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}
      </div>
    </div>
  );
};
