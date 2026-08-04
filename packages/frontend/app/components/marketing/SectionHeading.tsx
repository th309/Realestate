import type { ReactNode } from "react";
import { HEADING } from "./layout-contract";

/**
 * The repeated section-header unit: coloured uppercase eyebrow, H2 at the one
 * section scale, optional subhead. Using this everywhere is most of what makes
 * a long page read as ordered rather than stacked.
 */

/**
 * `onDark` is a FIXED white, not `inverse-on-surface`. The only band using it —
 * the saturated top of the homepage's indigo fade — is dark in both colour
 * schemes, so an inverting token would flip to dark text on it in dark mode.
 * Same reasoning as the hero monitor's caption scrim.
 */
const TONE = {
  onLight: {
    eyebrow: "text-tertiary-text",
    title: "text-on-surface",
    subhead: "text-on-surface-variant",
  },
  onDark: {
    eyebrow: "text-tertiary",
    title: "text-white",
    subhead: "text-white/80",
  },
} as const;

export function SectionHeading({
  eyebrow,
  title,
  subhead,
  align = "center",
  tone = "onLight",
}: {
  eyebrow?: string;
  title: string;
  subhead?: ReactNode;
  align?: "center" | "start";
  /** Set `onDark` for sections on the saturated top of the page fade. */
  tone?: keyof typeof TONE;
}) {
  const alignment =
    align === "center"
      ? "mx-auto items-center text-center"
      : "items-start text-left";
  const color = TONE[tone];

  return (
    <div className={`mb-10 flex max-w-3xl flex-col gap-4 ${alignment}`}>
      {eyebrow ? (
        <span
          className={`text-xs font-bold uppercase tracking-[0.15em] ${color.eyebrow}`}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2 className={`${HEADING.section} text-balance ${color.title}`}>
        {title}
      </h2>
      {subhead ? (
        <p className={`max-w-2xl text-lg ${color.subhead}`}>{subhead}</p>
      ) : null}
    </div>
  );
}
