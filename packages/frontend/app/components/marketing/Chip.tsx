import type { ReactNode } from "react";

type ChipTone = "neutral" | "primary" | "positive" | "warning";

const TONE: Record<ChipTone, string> = {
  neutral: "border-outline-variant bg-surface text-on-surface",
  primary: "border-transparent bg-primary text-on-primary",
  positive:
    "border-tertiary/40 bg-tertiary-container text-on-tertiary-container",
  warning: "border-warning/40 bg-warning-container text-on-warning-container",
};

/**
 * One pill for every chip on the site — feature switchers, taxonomy tags,
 * filter labels, presets. Replaces roughly eleven independent chip
 * implementations scattered across the codebase.
 */
export function Chip({
  children,
  icon,
  tone = "neutral",
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: ChipTone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm ${TONE[tone]}`}
    >
      {icon ? (
        <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
      ) : null}
      {children}
    </span>
  );
}
