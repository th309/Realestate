import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants";
import { LONG_FORM_VISUAL_RHYTHM_FRAMES } from "../constants/long-form-rhythm";
import { AnimatedEntrance } from "../motion";
import {
  BORDER_WIDTH,
  FONTS,
  NUMERIC,
  PALETTE,
  brandBorder,
  brandFill,
  withAlpha,
} from "../styles/tokens";
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

interface CardDef {
  key: keyof MarketStats;
  label: string;
  format: (v: number) => string;
  description: string;
  /** Color the numeral by sign (YoY-style semantics). */
  signed?: boolean;
  area: string;
}

const CARD_DEFS: CardDef[] = [
  {
    key: "medianPrice",
    label: "Median Home Value",
    format: formatPrice,
    description: "Zillow ZHVI",
    area: "hero",
  },
  {
    key: "medianRent",
    label: "Median Rent",
    format: formatPrice,
    description: "Rent index",
    area: "rent",
  },
  {
    key: "homeValueYoyPct",
    label: "Home Value YoY",
    format: (v) => formatPct(v, 2),
    description: "Year-over-year change",
    signed: true,
    area: "yoy",
  },
  {
    key: "medianIncome",
    label: "Household Income",
    format: formatPrice,
    description: "US Census",
    area: "income",
  },
  {
    key: "homeownershipPct",
    label: "Homeownership",
    format: (v) => `${v.toFixed(1)}%`,
    description: "Of occupied housing",
    area: "own",
  },
  {
    key: "population",
    label: "Metro Population",
    format: formatPopulation,
    description: "US Census",
    area: "pop",
  },
];

interface CardProps {
  def: CardDef;
  value: number;
  index: number;
  hero: boolean;
  isVertical: boolean;
  spotlight: boolean;
}

const StatCard: React.FC<CardProps> = ({
  def,
  value,
  index,
  hero,
  isVertical,
  spotlight,
}) => {
  const numeralColor = def.signed
    ? value >= 0
      ? PALETTE.positive
      : PALETTE.negative
    : hero
      ? PALETTE.indigoLight
      : COLORS.text;

  const labelSize = isVertical ? (hero ? 30 : 26) : hero ? 24 : 19;
  const valueSize = isVertical ? (hero ? 110 : 60) : hero ? 84 : 46;
  const descSize = isVertical ? 22 : 16;

  return (
    <AnimatedEntrance
      index={index}
      delay={6}
      from="rise"
      style={{ gridArea: def.area, display: "flex", minWidth: 0 }}
    >
      <div
        style={{
          background: hero
            ? brandFill(PALETTE.indigo)
            : brandFill(PALETTE.container),
          borderRadius: 24,
          padding: isVertical
            ? hero
              ? "44px 48px"
              : "34px 38px"
            : hero
              ? "34px 40px"
              : "24px 28px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: hero ? 14 : 8,
          border: spotlight
            ? brandBorder(COLORS.accent)
            : brandBorder(PALETTE.indigoLight, 0.28),
          boxShadow: spotlight
            ? `0 12px 40px ${withAlpha(PALETTE.indigo, 0.35)}`
            : undefined,
          transform: spotlight ? "scale(1.02)" : undefined,
          flex: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: labelSize,
            color: COLORS.textMuted,
            fontWeight: 500,
            letterSpacing: "0.04em",
          }}
        >
          {def.label}
        </span>
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: valueSize,
            fontWeight: 700,
            color: numeralColor,
            lineHeight: 1,
            letterSpacing: "-2px",
            ...NUMERIC,
          }}
        >
          {def.format(value)}
        </span>
        <span style={{ fontSize: descSize, color: COLORS.textDim }}>
          {def.description}
        </span>
      </div>
    </AnimatedEntrance>
  );
};

/**
 * Asymmetric stat mosaic: the headline value (median home value) gets a
 * hero cell ~2× the others; the rest fill a varied grid. Cards enter with
 * the house 4-frame stagger; the rotating spotlight keeps long holds alive.
 */
export const StatCards: React.FC<StatCardsProps> = ({ market, stats }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const focusIdx =
    Math.floor(frame / LONG_FORM_VISUAL_RHYTHM_FRAMES) % CARD_DEFS.length;

  const titleSize = isVertical ? 46 : 34;
  const eyebrowSize = isVertical ? 22 : 16;
  const padding = isVertical ? 64 : 110;

  const gridTemplateAreas = isVertical
    ? `"hero hero" "yoy rent" "income own" "pop pop"`
    : `"hero hero rent" "hero hero yoy" "income own pop"`;

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: FONTS.body,
        padding: `0 ${padding}px`,
        gap: isVertical ? 40 : 28,
        boxSizing: "border-box",
      }}
    >
      <AnimatedEntrance index={0} from="left" distance={32}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: BORDER_WIDTH,
              background: COLORS.accent,
            }}
          />
          <span
            style={{
              fontSize: eyebrowSize,
              fontWeight: 600,
              color: COLORS.accent,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
            }}
          >
            Market Stats
          </span>
        </div>
      </AnimatedEntrance>
      <AnimatedEntrance index={1} from="rise" distance={28}>
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: "-1px",
          }}
        >
          {market}
        </div>
      </AnimatedEntrance>

      <div
        style={{
          display: "grid",
          gridTemplateAreas,
          gridTemplateColumns: isVertical
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(3, minmax(0, 1fr))",
          gap: isVertical ? 22 : 20,
          width: "100%",
        }}
      >
        {CARD_DEFS.map((def, i) => (
          <StatCard
            key={def.key}
            def={def}
            value={stats[def.key]}
            index={i + 2}
            hero={def.area === "hero"}
            isVertical={!!isVertical}
            spotlight={i === focusIdx}
          />
        ))}
      </div>
    </div>
  );
};
