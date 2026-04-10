import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { COLORS } from "../constants";
import type { MarketStats } from "../types";

interface StatCardsProps {
  market: string;
  stats: MarketStats;
  isVertical?: boolean;
}

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function formatRatio(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const CARD_DEFS = [
  {
    key: "medianPrice" as keyof MarketStats,
    label: "Median Home Price",
    icon: "🏠",
    format: (v: number) => formatPrice(v),
    description: "Zillow ZHVI",
  },
  {
    key: "daysOnMarket" as keyof MarketStats,
    label: "Days on Market",
    icon: "📅",
    format: (v: number) => `${Math.round(v)} days`,
    description: "Avg. listing duration",
  },
  {
    key: "demandScore" as keyof MarketStats,
    label: "Demand Score",
    icon: "📈",
    format: (v: number) => `${Math.round(v)}/100`,
    description: "PropertyIQ demand index",
  },
  {
    key: "pendingRatio" as keyof MarketStats,
    label: "Pending Ratio",
    icon: "⏳",
    format: (v: number) => formatRatio(v),
    description: "Under contract / listed",
  },
];

interface CardProps {
  label: string;
  icon: string;
  value: string;
  description: string;
  delay: number;
  isVertical: boolean;
}

const StatCard: React.FC<CardProps> = ({ label, icon, value, description, delay, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { damping: 18, stiffness: 100, mass: 0.8 },
    durationInFrames: 40,
  });

  const opacity = interpolate(appear, [0, 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(appear, [0, 1], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cardPad = isVertical ? "40px 44px" : "28px 32px";
  const iconSize = isVertical ? 52 : 40;
  const labelSize = isVertical ? 28 : 20;
  const valueSize = isVertical ? 64 : 48;
  const descSize = isVertical ? 22 : 16;

  return (
    <div
      style={{
        background: COLORS.bgCard,
        borderRadius: 20,
        padding: cardPad,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        border: `1px solid ${COLORS.bgCardAlt}`,
        opacity,
        transform: `translateY(${translateY}px)`,
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: iconSize }}>{icon}</span>
        <span style={{ fontSize: labelSize, color: COLORS.textMuted, fontWeight: 500 }}>
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: valueSize,
          fontWeight: 800,
          color: COLORS.text,
          lineHeight: 1,
          letterSpacing: "-1px",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: descSize, color: COLORS.textDim }}>{description}</div>
    </div>
  );
};

export const StatCards: React.FC<StatCardsProps> = ({ market, stats, isVertical }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleSize = isVertical ? 48 : 34;
  const padding = isVertical ? 60 : 100;

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
        Market Stats
        <span
          style={{
            color: COLORS.textMuted,
            fontWeight: 400,
            fontSize: titleSize * 0.65,
          }}
        >
          {" "}
          — {market}
        </span>
      </div>

      {/* Cards grid */}
      <div
        style={{
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          gap: isVertical ? 24 : 24,
          width: "100%",
        }}
      >
        {CARD_DEFS.map((def, i) => (
          <StatCard
            key={def.key}
            label={def.label}
            icon={def.icon}
            value={def.format(stats[def.key])}
            description={def.description}
            delay={i * 18}
            isVertical={!!isVertical}
          />
        ))}
      </div>
    </div>
  );
};
