import type { ReactNode } from "react";
import { HEADING } from "./layout-contract";

/**
 * The repeated section-header unit: coloured uppercase eyebrow, H2 at the one
 * section scale, optional subhead. Using this everywhere is most of what makes
 * a long page read as ordered rather than stacked.
 */
export function SectionHeading({
  eyebrow,
  title,
  subhead,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  subhead?: ReactNode;
  align?: "center" | "start";
}) {
  const alignment =
    align === "center"
      ? "mx-auto items-center text-center"
      : "items-start text-left";

  return (
    <div className={`mb-10 flex max-w-3xl flex-col gap-4 ${alignment}`}>
      {eyebrow ? (
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-tertiary">
          {eyebrow}
        </span>
      ) : null}
      <h2 className={`${HEADING.section} text-balance text-on-surface`}>
        {title}
      </h2>
      {subhead ? (
        <p className="max-w-2xl text-lg text-on-surface-variant">{subhead}</p>
      ) : null}
    </div>
  );
}
