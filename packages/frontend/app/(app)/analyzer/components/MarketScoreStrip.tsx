"use client";

import { ArrowRight } from "lucide-react";
import { LABEL_CLASS } from "./primitives/card";
import { useDirectionalColor } from "./primitives/useDirectionalColor";
import type { PiqByGeo } from "../lib/use-piq-by-geo";

type GeoLevel = "metro" | "county" | "zip";
const GEO_ORDER: GeoLevel[] = ["metro", "county", "zip"];
const GEO_LABEL: Record<GeoLevel, string> = {
  metro: "Metro",
  county: "County",
  zip: "ZIP",
};

/** 2πr for the r=25 track below — the full circumference the arc is cut from. */
const RING_CIRCUMFERENCE = 157.1;

function ScoreRing({ level, score }: { level: GeoLevel; score: number }) {
  const color = useDirectionalColor({ value: score, variant: "score" });
  const rounded = Math.round(score);

  return (
    <div
      className="flex items-center gap-2.5"
      data-piq-chip={level}
      aria-label={`${GEO_LABEL[level]} PropertyIQ ${rounded}`}
    >
      <div className="relative size-[56px] flex-none">
        <svg
          viewBox="0 0 60 60"
          className="block size-full -rotate-90"
          aria-hidden
        >
          <circle
            cx="30"
            cy="30"
            r="25"
            fill="none"
            stroke="var(--piq-border)"
            strokeWidth="6"
          />
          <circle
            cx="30"
            cy="30"
            r="25"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={
              RING_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, score)) / 100)
            }
          />
        </svg>
        <b className="absolute inset-0 grid place-items-center font-mono text-[19px] font-bold tabular-nums text-piq-ink">
          {rounded}
        </b>
      </div>
      <span className={LABEL_CLASS}>{GEO_LABEL[level]}</span>
    </div>
  );
}

interface MarketScoreStripProps {
  /** PIQ score at each available geography level. Levels with null are hidden. */
  piqByGeo?: PiqByGeo | null;
  className?: string;
}

/**
 * The spec's market strip: PropertyIQ scores as filled rings on a wash tinted
 * by the property's own micro-market, with a jump to the full market section.
 *
 * This used to be a boxed row restating the address that already sits in the
 * page head, with the scores reduced to three small dots at the far right —
 * a card's worth of height for a line of text and a detail nobody could read.
 * The address moved up; the score, which is the one piece of market context
 * worth seeing before the numbers, gets the space instead.
 *
 * All three levels render rather than one headline. For a single address the
 * gap between them is the story — a metro at 75 inside a ZIP at 43 says the
 * micro-market lags the region, and collapsing that to one number hides it.
 */
export function MarketScoreStrip({
  piqByGeo,
  className = "",
}: MarketScoreStripProps) {
  const rings = piqByGeo
    ? GEO_ORDER.filter((lvl) => piqByGeo[lvl] != null).map((lvl) => ({
        level: lvl,
        score: piqByGeo[lvl] as number,
      }))
    : [];

  // The wash follows the most specific score available — the property's own
  // market, not the region it happens to sit in.
  const finest = rings.length > 0 ? rings[rings.length - 1] : null;
  const washColor = useDirectionalColor({
    value: finest?.score ?? 50,
    variant: "score",
  });

  if (rings.length === 0) return null;

  return (
    <div
      data-market-score-strip
      className={`mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-piq border border-piq-line px-[18px] py-4 shadow-piq ${className}`}
      style={{
        // A hint, not a status band. At 14% the amber of a weak ZIP score
        // washed the full strip and read as a warning banner across the top of
        // the page; the tint only has to bias the card, the rings carry the
        // reading. Clears to plain surface well before the halfway mark.
        background: `linear-gradient(100deg, color-mix(in srgb, ${washColor} 9%, var(--piq-surface)), var(--piq-surface) 48%)`,
      }}
    >
      <span className={`${LABEL_CLASS} flex-none`}>PropertyIQ Score</span>
      <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-3">
        {rings.map((r) => (
          <ScoreRing key={r.level} level={r.level} score={r.score} />
        ))}
      </div>
      <a
        href="#market"
        className="inline-flex flex-none items-center gap-1.5 text-[12.5px] font-semibold text-piq-indigo hover:underline"
      >
        Open market
        <ArrowRight size={14} strokeWidth={2} aria-hidden />
      </a>
    </div>
  );
}
