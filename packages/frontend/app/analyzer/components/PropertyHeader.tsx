"use client";

import { piq } from "./primitives/piqTokens";
import { useDirectionalColor } from "./primitives/useDirectionalColor";
import type { PiqByGeo } from "../lib/use-piq-by-geo";

type GeoLevel = "metro" | "county" | "zip";
const GEO_ORDER: GeoLevel[] = ["metro", "county", "zip"];
const GEO_LABEL: Record<GeoLevel, string> = {
  metro: "Metro",
  county: "County",
  zip: "ZIP",
};

interface PiqGeoChipProps {
  level: GeoLevel;
  score: number;
}

function PiqGeoChip({ level, score }: PiqGeoChipProps) {
  const color = useDirectionalColor({ value: score, variant: "score" });
  return (
    <div
      className="inline-flex items-center gap-1.5"
      data-piq-chip={level}
      aria-label={`${GEO_LABEL[level]} PropertyIQ ${Math.round(score)}`}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: color,
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
        }}
      >
        {Math.round(score)}
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: piq.textMuted,
          textTransform: "uppercase",
        }}
      >
        {GEO_LABEL[level]}
      </span>
    </div>
  );
}

interface PropertyHeaderProps {
  address: string;
  /** PIQ score at each available geography level. Levels with null are hidden. */
  piqByGeo?: PiqByGeo | null;
  className?: string;
}

/**
 * Horizontal strip with the resolved address on the left and up to three
 * PIQ score chips on the right — one per geo level (Metro / County / ZIP).
 * Each level renders only when its score is available so a property in an
 * unmetropolitan ZIP gracefully degrades to County + ZIP.
 */
export function PropertyHeader({
  address,
  piqByGeo,
  className = "",
}: PropertyHeaderProps) {
  const chips = piqByGeo
    ? GEO_ORDER.filter((lvl) => piqByGeo[lvl] != null).map((lvl) => ({
        level: lvl,
        score: piqByGeo[lvl] as number,
      }))
    : [];

  return (
    <div
      data-property-header
      className={`flex items-center justify-between gap-4 mb-6 ${className}`}
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        background: piq.canvas,
        border: `0.5px solid ${piq.border}`,
      }}
    >
      <span
        className="truncate"
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: piq.textPrimary,
          letterSpacing: "-0.005em",
        }}
      >
        {address}
      </span>
      {chips.length > 0 && (
        <div className="flex items-center gap-3 flex-shrink-0">
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: piq.textMuted,
              textTransform: "uppercase",
            }}
          >
            PropertyIQ Score
          </span>
          {chips.map((c) => (
            <PiqGeoChip key={c.level} level={c.level} score={c.score} />
          ))}
        </div>
      )}
    </div>
  );
}
