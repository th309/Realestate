import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, scoreTierColor, scoreTierLabel } from "../constants";
import type { MarketData, ComparisonMarket } from "../types";

interface ComparisonProps {
  primary: MarketData;
  others: ComparisonMarket[];
  isVertical?: boolean;
}

interface MarketColumnProps {
  market: string;
  score: number;
  grade: string;
  trend: string;
  trendChange: number;
  isPrimary: boolean;
  delay: number;
  isVertical: boolean;
}

const MarketColumn: React.FC<MarketColumnProps> = ({
  market,
  score,
  grade,
  trend,
  trendChange,
  isPrimary,
  delay,
  isVertical,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tierColor = scoreTierColor(score);

  const appear = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { damping: 20, stiffness: 80 },
    durationInFrames: 60,
  });

  const opacity = interpolate(appear, [0, 0.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const counterProgress = spring({
    fps,
    frame: Math.max(0, frame - delay - 10),
    config: { damping: 22, stiffness: 70 },
    durationInFrames: 90,
  });
  const displayScore = Math.round(interpolate(counterProgress, [0, 1], [0, score]));

  const trendColor =
    trend === "up" ? COLORS.trendUp : trend === "down" ? COLORS.trendDown : COLORS.trendStable;
  const trendSymbol = trend === "up" ? "▲" : trend === "down" ? "▼" : "●";

  const marketSize = isVertical ? 36 : 26;
  const scoreSize = isVertical ? 120 : 96;
  const gradeSize = isVertical ? 28 : 22;

  const circumference = 2 * Math.PI * 100;
  const arcSize = isVertical ? 250 : 240;
  const arcRadius = arcSize / 2 - 15;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: isVertical ? 20 : 16,
        opacity,
        padding: isVertical ? "24px 16px" : "20px 16px",
        background: isPrimary ? `${tierColor}0a` : COLORS.bgCard,
        borderRadius: 24,
        border: isPrimary ? `2px solid ${tierColor}40` : `1px solid ${COLORS.bgCardAlt}`,
        position: "relative",
      }}
    >
      {/* Primary badge */}
      {isPrimary && (
        <div
          style={{
            position: "absolute",
            top: -14,
            background: tierColor,
            color: "#000",
            fontSize: isVertical ? 18 : 13,
            fontWeight: 700,
            padding: "4px 16px",
            borderRadius: 20,
            letterSpacing: "0.1em",
          }}
        >
          FEATURED MARKET
        </div>
      )}

      {/* Market name */}
      <div
        style={{
          fontSize: marketSize,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: "center",
        }}
      >
        {market}
      </div>

      {/* Score arc */}
      <div style={{ position: "relative", width: arcSize, height: arcSize }}>
        <svg
          width={arcSize}
          height={arcSize}
          style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}
        >
          <circle
            cx={arcSize / 2}
            cy={arcSize / 2}
            r={arcRadius}
            fill="none"
            stroke={COLORS.bgCardAlt}
            strokeWidth={12}
          />
          <circle
            cx={arcSize / 2}
            cy={arcSize / 2}
            r={arcRadius}
            fill="none"
            stroke={tierColor}
            strokeWidth={12}
            strokeDasharray={circumference}
            strokeDashoffset={
              circumference * (1 - (score / 100) * interpolate(counterProgress, [0, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }))
            }
            strokeLinecap="round"
          />
        </svg>
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
              fontSize: scoreSize,
              fontWeight: 900,
              color: tierColor,
              lineHeight: 1,
              letterSpacing: "-3px",
            }}
          >
            {displayScore}
          </span>
        </div>
      </div>

      {/* Grade */}
      <div
        style={{
          background: `${tierColor}20`,
          border: `2px solid ${tierColor}`,
          borderRadius: 10,
          padding: isVertical ? "10px 28px" : "8px 22px",
          fontSize: gradeSize,
          fontWeight: 800,
          color: tierColor,
          letterSpacing: "0.1em",
        }}
      >
        {grade}
      </div>

      {/* Trend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: isVertical ? 26 : 20,
          color: trendColor,
          fontWeight: 600,
        }}
      >
        <span>{trendSymbol}</span>
        <span>
          {trend === "stable"
            ? "FLAT"
            : `${trend === "up" ? "+" : ""}${trendChange} pts`}
        </span>
      </div>
    </div>
  );
};

export const Comparison: React.FC<ComparisonProps> = ({ primary, others, isVertical }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const allMarkets = [
    { ...primary, isPrimary: true },
    ...others.map((o) => ({ ...o, stats: primary.stats, history: [], periodDate: primary.periodDate, isPrimary: false })),
  ];

  const titleSize = isVertical ? 48 : 36;
  const padding = isVertical ? 40 : 80;

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
        padding: `0 ${padding}px`,
        gap: isVertical ? 40 : 32,
        boxSizing: "border-box",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: titleSize,
          fontWeight: 700,
          color: COLORS.text,
          alignSelf: "flex-start",
          width: "100%",
        }}
      >
        Market Comparison
      </div>

      {/* Market columns */}
      <div
        style={{
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          gap: isVertical ? 24 : 28,
          width: "100%",
          alignItems: "stretch",
        }}
      >
        {allMarkets.map((m, i) => (
          <MarketColumn
            key={m.market}
            market={m.market}
            score={m.score}
            grade={m.grade}
            trend={m.trend}
            trendChange={m.trendChange}
            isPrimary={m.isPrimary}
            delay={i * 25}
            isVertical={!!isVertical}
          />
        ))}
      </div>
    </div>
  );
};
