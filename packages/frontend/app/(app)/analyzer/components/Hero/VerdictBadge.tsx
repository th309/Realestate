"use client";

import {
  type Verdict,
  VERDICT_LETTER,
  VERDICT_LABEL,
  verdictColor,
} from "../../lib/format-helpers";

interface VerdictBadgeProps {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
}

const SIZE = {
  sm: { letter: "text-5xl", label: "text-xs", pad: "px-3 py-2" },
  md: { letter: "text-7xl", label: "text-sm", pad: "px-4 py-3" },
  lg: { letter: "text-8xl", label: "text-base", pad: "px-5 py-4" },
} as const;

export function VerdictBadge({ verdict, size = "md" }: VerdictBadgeProps) {
  const styles = SIZE[size];
  const color = verdictColor(verdict);
  return (
    <div
      data-verdict-badge
      data-verdict={verdict}
      className={`inline-flex flex-col items-center justify-center ${styles.pad}`}
    >
      <span
        data-verdict-letter
        className={`font-mono font-bold leading-none ${styles.letter}`}
        style={{ color }}
      >
        {VERDICT_LETTER[verdict]}
      </span>
      <span
        data-verdict-label
        className={`mt-2 uppercase tracking-wide font-semibold ${styles.label}`}
        style={{ color }}
      >
        {VERDICT_LABEL[verdict]}
      </span>
    </div>
  );
}
