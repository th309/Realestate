"use client";

import { Star } from "lucide-react";

export type RentCastState = "fresh" | "stale" | "missing";

interface RentCastBadgeProps {
  state: RentCastState;
}

const TOTAL_STARS = 5;

/**
 * How much of the rating is filled, and in what tone, per freshness state.
 * `missing` is deliberately red rather than grey — a field with no market
 * value behind it is a hole in the analysis, not a neutral condition.
 */
const STATE: Record<
  RentCastState,
  { filled: number; label: string; tone: string }
> = {
  fresh: { filled: 5, label: "RentCast", tone: "text-piq-green" },
  stale: { filled: 3, label: "RentCast (stale)", tone: "text-piq-amber" },
  missing: { filled: 1, label: "Estimate", tone: "text-piq-red" },
};

/**
 * Where a field's value came from and how much to trust it — the spec's
 * `.conf` row: a five-star rating followed by the source name.
 *
 * This was a coloured emoji (🟢 / 🟡 / ⚪) beside the source. Emoji render in
 * the platform's own art at the platform's own weight, which sits outside the
 * icon set the rest of the page uses, and a single dot only encodes a
 * three-way state without saying how confident any of them is. Stars carry
 * the same states and read as a rating, which is what this is.
 */
export function RentCastBadge({ state }: RentCastBadgeProps) {
  const c = STATE[state];
  return (
    <span
      data-rentcast-badge
      data-state={state}
      className="mt-[5px] inline-flex items-center gap-[5px]"
    >
      <span
        className={`flex gap-px ${c.tone}`}
        role="img"
        aria-label={`${c.label}: ${c.filled} of ${TOTAL_STARS} confidence`}
      >
        {Array.from({ length: TOTAL_STARS }, (_, i) => (
          <Star
            key={i}
            size={10}
            aria-hidden
            className={i < c.filled ? "fill-current" : "text-piq-line"}
            fill={i < c.filled ? "currentColor" : "none"}
            strokeWidth={0}
          />
        ))}
      </span>
      <span className="text-[10.5px] text-piq-muted">{c.label}</span>
    </span>
  );
}
