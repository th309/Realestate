"use client";

export type RentCastState = "fresh" | "stale" | "missing";

interface RentCastBadgeProps {
  state: RentCastState;
}

const COPY: Record<
  RentCastState,
  { dot: string; label: string; tone: string }
> = {
  fresh: { dot: "🟢", label: "RentCast", tone: "text-[var(--md-tertiary)]" },
  stale: {
    dot: "🟡",
    label: "RentCast (stale)",
    tone: "text-[var(--md-warning)]",
  },
  missing: { dot: "⚪", label: "RentCast", tone: "text-on-surface-variant" },
};

export function RentCastBadge({ state }: RentCastBadgeProps) {
  const c = COPY[state];
  return (
    <span
      data-rentcast-badge
      data-state={state}
      className={`inline-flex items-center gap-1 text-[10px] font-mono ${c.tone}`}
    >
      <span aria-hidden>{c.dot}</span>
      <span>{c.label}</span>
    </span>
  );
}
