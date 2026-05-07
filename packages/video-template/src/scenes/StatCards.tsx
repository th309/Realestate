import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLORS } from "../constants";
import { LONG_FORM_VISUAL_RHYTHM_FRAMES } from "../constants/long-form-rhythm";
import type { MarketStats } from "../types";
import { useLayoutConfig } from "../layout/useLayoutConfig";

interface StatCardsProps {
  market: string;
  stats: MarketStats;
}

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function formatPopulation(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

function formatPct(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

const CARD_DEFS = [
  {
    key: "medianPrice" as keyof MarketStats,
    label: "Median Home Value",
    icon: "🏠",
    format: (v: number) => formatPrice(v),
    description: "Zillow ZHVI",
  },
  {
    key: "medianRent" as keyof MarketStats,
    label: "Median Rent",
    icon: "🏢",
    format: (v: number) => formatPrice(v),
    description: "Rent index",
  },
  {
    key: "homeValueYoyPct" as keyof MarketStats,
    label: "Home Value YoY",
    icon: "📈",
    format: (v: number) => formatPct(v, 2),
    description: "Year-over-year change",
  },
  {
    key: "medianIncome" as keyof MarketStats,
    label: "Median Household Income",
    icon: "💵",
    format: (v: number) => formatPrice(v),
    description: "US Census",
  },
  {
    key: "homeownershipPct" as keyof MarketStats,
    label: "Homeownership",
    icon: "🔑",
    format: (v: number) => `${v.toFixed(1)}%`,
    description: "Of occupied housing",
  },
  {
    key: "population" as keyof MarketStats,
    label: "Metro Population",
    icon: "👥",
    format: (v: number) => formatPopulation(v),
    description: "US Census",
  },
];

interface CardProps {
  label: string;
  icon: string;
  value: string;
  description: string;
  delay: number;
  isVertical: boolean;
  spotlight: boolean;
}

const StatCard: React.FC<CardProps> = ({
  label,
  icon,
  value,
  description,
  delay,
  isVertical,
  spotlight,
}) => {
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
        border: spotlight
          ? `2px solid rgba(57,73,171,0.85)`
          : `1px solid ${COLORS.bgCardAlt}`,
        opacity,
        transform: `translateY(${translateY}px) scale(${spotlight ? 1.03 : 1})`,
        flex: 1,
        minWidth: 0,
        boxShadow: spotlight
          ? "0 12px 40px rgba(57,73,171,0.35)"
          : undefined,
        transition: "box-shadow 0.3s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: iconSize }}>{icon}</span>
        <span
          style={{
            fontSize: labelSize,
            color: COLORS.textMuted,
            fontWeight: 500,
          }}
        >
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
      <div style={{ fontSize: descSize, color: COLORS.textDim }}>
        {description}
      </div>
    </div>
  );
};

export const StatCards: React.FC<StatCardsProps> = ({ market, stats }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const focusIdx =
    Math.floor(frame / LONG_FORM_VISUAL_RHYTHM_FRAMES) % CARD_DEFS.length;

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

      {/* Cards grid: 3×2 on 16:9, column on 9:16 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isVertical ? "1fr" : "repeat(3, minmax(0, 1fr))",
          gap: isVertical ? 20 : 20,
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
            spotlight={i === focusIdx}
          />
        ))}
      </div>
    </div>
  );
};
